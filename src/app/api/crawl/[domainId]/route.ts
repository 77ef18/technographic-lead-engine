import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { executeCrawlJob } from "@/lib/crawl";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type DomainRow = {
  id: string;
  domain: string;
  status: "active" | "paused" | "archived";
};

type JobRow = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "retrying";
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ domainId: string }> },
) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const { domainId } = await context.params;
  const parsedId = z.string().uuid().safeParse(domainId);
  if (!parsedId.success) {
    return jsonError("Invalid domain id.");
  }

  try {
    const domainResult = await dbQuery<DomainRow>(
      `
        SELECT id, domain, status
        FROM domains
        WHERE id = $1
        LIMIT 1
      `,
      [parsedId.data],
    );

    const domain = domainResult.rows[0];
    if (!domain) {
      return jsonError("Domain not found.", 404);
    }

    if (domain.status !== "active") {
      return jsonError("Domain is not active and cannot be crawled.", 400);
    }

    const jobInsert = await dbQuery<JobRow>(
      `
        INSERT INTO crawl_jobs (domain_id, trigger, status, attempts)
        VALUES ($1, 'manual', 'queued', 1)
        RETURNING id, status
      `,
      [domain.id],
    );

    const job = jobInsert.rows[0];
    try {
      const summary = await executeCrawlJob(job.id, {
        id: domain.id,
        domain: domain.domain,
      });

      return Response.json({
        crawlJob: {
          id: job.id,
          status: "succeeded",
          domainId: domain.id,
          ...summary,
        },
      });
    } catch (error) {
      return jsonError("Crawl failed. Job moved to retry/dead-letter flow.", 500, {
        crawlJobId: job.id,
        details: String(error),
      });
    }
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }

    throw error;
  }
}
