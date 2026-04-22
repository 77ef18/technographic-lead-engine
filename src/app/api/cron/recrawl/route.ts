import type { NextRequest } from "next/server";

import { isAdminRequest } from "@/lib/admin";
import { executeCrawlJob } from "@/lib/crawl";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type CandidateRow = {
  id: string;
  domain: string;
};

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return jsonError("Unauthorized.", 401);
  }

  const batchSize = Number(request.nextUrl.searchParams.get("batch") ?? 10);
  const staleHours = Number(request.nextUrl.searchParams.get("staleHours") ?? 168);

  try {
    const candidates = await dbQuery<CandidateRow>(
      `
        SELECT d.id, d.domain
        FROM domains d
        LEFT JOIN LATERAL (
          SELECT e.created_at
          FROM enrichments e
          WHERE e.domain_id = d.id
          ORDER BY e.created_at DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE d.status = 'active'
          AND (
            latest.created_at IS NULL
            OR latest.created_at < NOW() - ($1 || ' hours')::interval
          )
        ORDER BY COALESCE(latest.created_at, d.created_at) ASC
        LIMIT $2
      `,
      [staleHours, batchSize],
    );

    const jobs: Array<{ domainId: string; domain: string; jobId: string; status: string }> = [];
    for (const domain of candidates.rows) {
      const insert = await dbQuery<{ id: string }>(
        `
          INSERT INTO crawl_jobs (domain_id, trigger, status, attempts)
          VALUES ($1, 'schedule', 'queued', 1)
          RETURNING id
        `,
        [domain.id],
      );

      const jobId = insert.rows[0].id;
      try {
        await executeCrawlJob(jobId, domain);
        jobs.push({ domainId: domain.id, domain: domain.domain, jobId, status: "succeeded" });
      } catch {
        jobs.push({ domainId: domain.id, domain: domain.domain, jobId, status: "failed" });
      }
    }

    return Response.json({
      scheduled: jobs.length,
      jobs,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
