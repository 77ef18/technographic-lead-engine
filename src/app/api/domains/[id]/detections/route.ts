import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type DetectionRow = {
  id: string;
  confidence: number;
  version: string | null;
  matched_signals_json: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  is_current: boolean;
  technology_slug: string;
  technology_name: string;
  technology_category: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { id } = await context.params;
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) {
    return jsonError("Invalid domain id.");
  }

  try {
    const result = await dbQuery<DetectionRow>(
      `
        SELECT
          d.id,
          d.confidence,
          d.version,
          d.matched_signals_json,
          d.first_seen_at,
          d.last_seen_at,
          d.is_current,
          t.slug AS technology_slug,
          t.name AS technology_name,
          t.category AS technology_category
        FROM detections d
        INNER JOIN technologies t ON t.id = d.technology_id
        WHERE d.domain_id = $1
        ORDER BY d.is_current DESC, d.confidence DESC
      `,
      [parsedId.data],
    );

    return Response.json({ detections: result.rows });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
