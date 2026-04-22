import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { normalizeDomain } from "@/lib/domain";
import { jsonError } from "@/lib/http";

const importSchema = z.object({
  csv: z.string().min(1),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

function parseCsvDomains(csv: string) {
  return csv
    .split(/\r?\n/)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, { details: parsed.error.flatten() });
  }

  const rawDomains = parseCsvDomains(parsed.data.csv);
  const unique = new Set<string>();
  const invalid: string[] = [];

  for (const raw of rawDomains) {
    try {
      unique.add(normalizeDomain(raw));
    } catch {
      invalid.push(raw);
    }
  }

  const status = parsed.data.status ?? "active";
  const domains = [...unique];
  const inserted: string[] = [];

  try {
    for (const domain of domains) {
      await dbQuery(
        `
          INSERT INTO domains (domain, status)
          VALUES ($1, $2)
          ON CONFLICT (domain) DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = NOW()
        `,
        [domain, status],
      );
      inserted.push(domain);
    }
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }

  return Response.json({
    importedCount: inserted.length,
    invalidCount: invalid.length,
    invalid,
  });
}
