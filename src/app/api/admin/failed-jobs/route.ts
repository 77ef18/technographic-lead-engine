import type { NextRequest } from "next/server";

import { isAdminRequest } from "@/lib/admin";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  try {
    const result = await dbQuery(
      `
        SELECT cj.id, cj.domain_id, d.domain, cj.status, cj.attempts, cj.error_message, cj.created_at
        FROM crawl_jobs cj
        INNER JOIN domains d ON d.id = cj.domain_id
        WHERE cj.status IN ('failed', 'retrying')
        ORDER BY cj.created_at DESC
        LIMIT 200
      `,
    );

    return Response.json({ failedJobs: result.rows });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
