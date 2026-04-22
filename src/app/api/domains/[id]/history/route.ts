import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type HistoryRow = {
  id: string;
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
    return jsonError("Invalid domain id.");
  }

  try {
    const result = await dbQuery<HistoryRow>(
      `
        SELECT
          id,
          trigger,
          status,
          attempts,
          started_at,
          finished_at,
          error_message,
          created_at
        FROM crawl_jobs
        WHERE domain_id = $1
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [parsedId.data],
    );

    return Response.json({ history: result.rows });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }

    throw error;
  }
}
