import crypto from "node:crypto";
import type { NextRequest } from "next/server";

import { dbQuery } from "@/lib/db";

type ApiKeyRow = {
  id: string;
  owner_id: string;
  key_hash: string;
  rate_limit_per_min: number;
  active: boolean;
};

type AuthResult =
  | { ok: true; keyId: string; ownerId: string; rateLimitPerMin: number }
  | { ok: false; status: number; error: string };

type WindowState = {
  count: number;
  resetAtMs: number;
};

const inMemoryRateLimit = new Map<string, WindowState>();

export function hashApiKey(rawKey: string) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey() {
  const secret = crypto.randomBytes(24).toString("base64url");
  return `tlle_${secret}`;
}

function checkRateLimit(keyId: string, limitPerMinute: number) {
  const now = Date.now();
  const windowMs = 60_000;
  const state = inMemoryRateLimit.get(keyId);

  if (!state || state.resetAtMs <= now) {
    inMemoryRateLimit.set(keyId, { count: 1, resetAtMs: now + windowMs });
    return { allowed: true };
  }

  if (state.count >= limitPerMinute) {
    return { allowed: false, retryAfterSeconds: Math.ceil((state.resetAtMs - now) / 1000) };
  }

  state.count += 1;
  inMemoryRateLimit.set(keyId, state);
  return { allowed: true };
}

export async function authenticateApiKey(request: NextRequest): Promise<AuthResult> {
  if (process.env.SKIP_API_KEY_AUTH === "true") {
    return {
      ok: true,
      keyId: "dev-bypass",
      ownerId: process.env.DEV_OWNER_ID ?? "00000000-0000-0000-0000-000000000000",
      rateLimitPerMin: Number(process.env.DEV_RATE_LIMIT_PER_MIN ?? 120),
    };
  }

  const rawKey = request.headers.get("x-api-key");
  if (!rawKey) {
    return { ok: false, status: 401, error: "Missing x-api-key header." };
  }

  const hash = hashApiKey(rawKey);
  const result = await dbQuery<ApiKeyRow>(
    `
      SELECT id, owner_id, key_hash, rate_limit_per_min, active
      FROM api_keys
      WHERE key_hash = $1
      LIMIT 1
    `,
    [hash],
  );

  const key = result.rows[0];
  if (!key || !key.active) {
    return { ok: false, status: 401, error: "Invalid or inactive API key." };
  }

  const rate = checkRateLimit(key.id, key.rate_limit_per_min);
  if (!rate.allowed) {
    return { ok: false, status: 429, error: `Rate limit exceeded. Retry in ${rate.retryAfterSeconds}s.` };
  }

  await dbQuery(
    `
      UPDATE api_keys
      SET last_used_at = NOW()
      WHERE id = $1
    `,
    [key.id],
  );

  return {
    ok: true,
    keyId: key.id,
    ownerId: key.owner_id,
    rateLimitPerMin: key.rate_limit_per_min,
  };
}
