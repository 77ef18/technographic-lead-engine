import type { NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/admin";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

const patchSchema = z.object({
  pattern: z.string().min(1).optional(),
  confidenceWeight: z.number().min(0).max(1).optional(),
  active: z.boolean().optional(),
  implies: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  excludes: z.array(z.string()).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  const { id } = await context.params;
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) {
    return jsonError("Invalid fingerprint id.");
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, { details: parsed.error.flatten() });
  }

  const updates: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [parsedId.data];
  let idx = 2;

  if (parsed.data.pattern !== undefined) {
    updates.push(`pattern = $${idx}`);
    values.push(parsed.data.pattern);
    idx += 1;
  }
  if (parsed.data.confidenceWeight !== undefined) {
    updates.push(`confidence_weight = $${idx}`);
    values.push(parsed.data.confidenceWeight);
    idx += 1;
  }
  if (parsed.data.active !== undefined) {
    updates.push(`active = $${idx}`);
    values.push(parsed.data.active);
    idx += 1;
  }
  if (parsed.data.implies !== undefined) {
    updates.push(`implies_json = $${idx}::jsonb`);
    values.push(JSON.stringify(parsed.data.implies));
    idx += 1;
  }
  if (parsed.data.requires !== undefined) {
    updates.push(`requires_json = $${idx}::jsonb`);
    values.push(JSON.stringify(parsed.data.requires));
    idx += 1;
  }
  if (parsed.data.excludes !== undefined) {
    updates.push(`excludes_json = $${idx}::jsonb`);
    values.push(JSON.stringify(parsed.data.excludes));
  }

  try {
    const result = await dbQuery(
      `
        UPDATE fingerprints
        SET ${updates.join(", ")}
        WHERE id = $1
        RETURNING *
      `,
      values,
    );
    if (!result.rows[0]) {
      return jsonError("Fingerprint not found.", 404);
    }
    return Response.json({ fingerprint: result.rows[0] });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
