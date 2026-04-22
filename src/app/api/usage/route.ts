import type { NextRequest } from "next/server";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const [domains, jobsByStatus, currentDetections, leadLists] = await Promise.all([
      dbQuery<{ count: string }>(`SELECT COUNT(*)::text AS count FROM domains`),
      dbQuery<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM crawl_jobs GROUP BY status`,
      ),
      dbQuery<{ count: string }>(`SELECT COUNT(*)::text AS count FROM detections WHERE is_current = TRUE`),
      dbQuery<{ count: string }>(`SELECT COUNT(*)::text AS count FROM lead_lists WHERE owner_id = $1`, [
        auth.ownerId,
      ]),
    ]);

    return Response.json({
      usage: {
        domains: Number(domains.rows[0]?.count ?? 0),
        currentDetections: Number(currentDetections.rows[0]?.count ?? 0),
        leadLists: Number(leadLists.rows[0]?.count ?? 0),
        jobsByStatus: jobsByStatus.rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = Number(row.count);
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
