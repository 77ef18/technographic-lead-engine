import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type EnrichmentRow = {
  id: string;
  title: string | null;
  description: string | null;
  language: string | null;
  country: string | null;
  region: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  facebook_url: string | null;
  dns_json: Record<string, unknown>;
  tls_json: Record<string, unknown>;
  raw_json: Record<string, unknown>;
  created_at: string;
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
    const result = await dbQuery<EnrichmentRow>(
      `
        SELECT
          id,
          title,
          description,
          language,
          country,
          region,
          linkedin_url,
          x_url,
          facebook_url,
          dns_json,
          tls_json,
          raw_json,
          created_at
        FROM enrichments
        WHERE domain_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [parsedId.data],
    );

    return Response.json({ enrichment: result.rows[0] ?? null });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
