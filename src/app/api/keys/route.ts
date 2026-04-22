import { z } from "zod";
import type { NextRequest } from "next/server";

import { generateApiKey, hashApiKey } from "@/lib/auth";
import { isAdminRequest } from "@/lib/admin";
import { dbQuery } from "@/lib/db";
import { jsonError } from "@/lib/http";

const createKeySchema = z.object({
  ownerId: z.string().uuid(),
  name: z.string().min(1).max(120),
  rateLimitPerMin: z.number().int().min(1).max(1000).default(60),
});

type ApiKeyRow = {
  id: string;
  owner_id: string;
  name: string;
  last_used_at: string | null;
  rate_limit_per_min: number;
  active: boolean;
  created_at: string;
};

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, { details: parsed.error.flatten() });
  }

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);

  const created = await dbQuery<ApiKeyRow>(
    `
      INSERT INTO api_keys (owner_id, key_hash, name, rate_limit_per_min, active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, owner_id, name, last_used_at, rate_limit_per_min, active, created_at
    `,
    [parsed.data.ownerId, keyHash, parsed.data.name, parsed.data.rateLimitPerMin],
  );

  return Response.json(
    {
      apiKey: {
        ...created.rows[0],
        raw_key: rawKey,
      },
    },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  const ownerId = request.nextUrl.searchParams.get("ownerId");
  if (!ownerId) {
    return jsonError("ownerId query param is required.");
  }

  const parsedOwnerId = z.string().uuid().safeParse(ownerId);
  if (!parsedOwnerId.success) {
    return jsonError("ownerId must be a valid UUID.");
  }

  const result = await dbQuery<ApiKeyRow>(
    `
      SELECT id, owner_id, name, last_used_at, rate_limit_per_min, active, created_at
      FROM api_keys
      WHERE owner_id = $1
      ORDER BY created_at DESC
    `,
    [parsedOwnerId.data],
  );

  return Response.json({ apiKeys: result.rows });
}
