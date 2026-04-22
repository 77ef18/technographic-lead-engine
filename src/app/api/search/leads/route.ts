import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/auth";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";
import { queryLeads } from "@/lib/leads";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const search = request.nextUrl.searchParams;
  const minConfidenceParam = search.get("minConfidence");
  const limitParam = search.get("limit");
  const offsetParam = search.get("offset");

  try {
    const leads = await queryLeads(
      {
        hasTech: search.get("hasTech") ?? undefined,
        techCategory: search.get("techCategory") ?? undefined,
        minConfidence: minConfidenceParam ? Number(minConfidenceParam) : undefined,
        lastScannedAfter: search.get("lastScannedAfter") ?? undefined,
        country: search.get("country") ?? undefined,
        language: search.get("language") ?? undefined,
      },
      limitParam ? Number(limitParam) : 200,
      offsetParam ? Number(offsetParam) : 0,
    );

    return Response.json({ leads });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
