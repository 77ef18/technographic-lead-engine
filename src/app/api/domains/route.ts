import { z } from "zod";
import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { normalizeDomain } from "@/lib/domain";
import { jsonError } from "@/lib/http";

const createDomainSchema = z.object({
  domain: z.string().min(3),
  status: z.enum(["active", "paused", "archived"]).optional(),
});

const querySchema = z.object({
  status: z.enum(["active", "paused", "archived"]).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

type DomainRow = {
  id: string;
  domain: string;
  status: "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
};

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const body = await request.json().catch(() => null);
  const parsed = createDomainSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, { details: parsed.error.flatten() });
  }

  let normalized: string;
  try {
    normalized = normalizeDomain(parsed.data.domain);
  } catch {
    return jsonError("Domain must be a valid public hostname.");
  }

  const status = parsed.data.status ?? "active";

  try {
    const result = await dbQuery<DomainRow>(
      `
        INSERT INTO domains (domain, status)
        VALUES ($1, $2)
        ON CONFLICT (domain) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING id, domain, status, created_at, updated_at
      `,
      [normalized, status],
    );

    return Response.json({ domain: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }

    throw error;
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const query = querySchema.safeParse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    offset: request.nextUrl.searchParams.get("offset") ?? undefined,
  });

  if (!query.success) {
    return jsonError("Invalid query parameters.", 400, { details: query.error.flatten() });
  }

  const filters: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (query.data.status) {
    filters.push(`status = $${idx}`);
    values.push(query.data.status);
    idx += 1;
  }

  if (query.data.search) {
    filters.push(`domain ILIKE $${idx}`);
    values.push(`%${query.data.search.toLowerCase()}%`);
    idx += 1;
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  values.push(query.data.limit, query.data.offset);

  try {
    const result = await dbQuery<DomainRow>(
      `
        SELECT id, domain, status, created_at, updated_at
        FROM domains
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${idx}
        OFFSET $${idx + 1}
      `,
      values,
    );

    return Response.json({ domains: result.rows });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }

    throw error;
  }
}
