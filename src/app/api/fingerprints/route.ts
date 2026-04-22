import type { NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/admin";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

const createFingerprintSchema = z.object({
  technologyId: z.string().uuid(),
  signalType: z.enum(["html", "script", "header", "cookie", "meta", "dns", "tls", "dom", "js"]),
  pattern: z.string().min(1),
  confidenceWeight: z.number().min(0).max(1),
  versionCapture: z.string().nullable().optional(),
  implies: z.array(z.string()).default([]),
  requires: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const result = await dbQuery(
      `
        SELECT
          f.id,
          f.technology_id,
          t.slug AS technology_slug,
          t.name AS technology_name,
          f.signal_type,
          f.pattern,
          f.confidence_weight,
          f.version_capture,
          f.implies_json,
          f.requires_json,
          f.excludes_json,
          f.active,
          f.updated_at
        FROM fingerprints f
        INNER JOIN technologies t ON t.id = f.technology_id
        ORDER BY t.name ASC, f.updated_at DESC
      `,
    );

    return Response.json({ fingerprints: result.rows });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);
  const parsed = createFingerprintSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, { details: parsed.error.flatten() });
  }

  try {
    const result = await dbQuery(
      `
        INSERT INTO fingerprints (
          technology_id,
          signal_type,
          pattern,
          confidence_weight,
          version_capture,
          implies_json,
          requires_json,
          excludes_json,
          active,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, NOW())
        RETURNING *
      `,
      [
        parsed.data.technologyId,
        parsed.data.signalType,
        parsed.data.pattern,
        parsed.data.confidenceWeight,
        parsed.data.versionCapture ?? null,
        JSON.stringify(parsed.data.implies),
        JSON.stringify(parsed.data.requires),
        JSON.stringify(parsed.data.excludes),
        parsed.data.active,
      ],
    );
    return Response.json({ fingerprint: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
