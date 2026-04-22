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
    const [jobsByStatus, avgDuration, detectionPerDomain, retryRate] = await Promise.all([
      dbQuery<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM crawl_jobs GROUP BY status`,
      ),
      dbQuery<{ avg_ms: string }>(
        `
          SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000), 0)::text AS avg_ms
          FROM crawl_jobs
          WHERE finished_at IS NOT NULL
            AND started_at IS NOT NULL
        `,
      ),
      dbQuery<{ avg_detections: string }>(
        `
          SELECT COALESCE(AVG(detection_count), 0)::text AS avg_detections
          FROM (
            SELECT domain_id, COUNT(*) AS detection_count
            FROM detections
            WHERE is_current = TRUE
            GROUP BY domain_id
          ) s
        `,
      ),
      dbQuery<{ retry_rate: string }>(
        `
          SELECT
            CASE WHEN COUNT(*) = 0
              THEN '0'
              ELSE (SUM(CASE WHEN attempts > 1 THEN 1 ELSE 0 END)::decimal / COUNT(*))::text
            END AS retry_rate
          FROM crawl_jobs
        `,
      ),
    ]);

    return Response.json({
      metrics: {
        jobsByStatus: jobsByStatus.rows,
        averageScanTimeMs: Number(avgDuration.rows[0]?.avg_ms ?? 0),
        averageDetectionsPerDomain: Number(detectionPerDomain.rows[0]?.avg_detections ?? 0),
        retryRate: Number(retryRate.rows[0]?.retry_rate ?? 0),
      },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
