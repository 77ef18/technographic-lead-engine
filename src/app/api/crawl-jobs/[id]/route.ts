import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type CrawlJobRow = {
  id: string;
  domain_id: string;
  trigger: "manual" | "schedule" | "api";
  status: "queued" | "running" | "succeeded" | "failed" | "retrying";
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
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
    return jsonError("Invalid crawl job id.");
  }

  try {
    const result = await dbQuery<CrawlJobRow>(
      `
        SELECT
          id,
          domain_id,
          trigger,
          status,
          attempts,
          started_at,
          finished_at,
          error_message,
          created_at
        FROM crawl_jobs
        WHERE id = $1
        LIMIT 1
      `,
      [parsedId.data],
    );

    if (!result.rows[0]) {
      return jsonError("Crawl job not found.", 404);
    }

    return Response.json({ crawlJob: result.rows[0] });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }

    throw error;
  }
}
