import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type LeadListEntryRow = {
  domain_id: string;
  domain: string;
  added_at: string;
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
    return jsonError("Invalid lead list id.");
  }

  try {
    const listResult = await dbQuery(
      `
        SELECT id, owner_id, name, filter_json, created_at, updated_at
        FROM lead_lists
        WHERE id = $1
        LIMIT 1
      `,
      [parsedId.data],
    );

    const leadList = listResult.rows[0] as
      | {
          id: string;
          owner_id: string;
          name: string;
          filter_json: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!leadList || leadList.owner_id !== auth.ownerId) {
      return jsonError("Lead list not found.", 404);
    }

    const entriesResult = await dbQuery<LeadListEntryRow>(
      `
        SELECT d.id AS domain_id, d.domain, lle.added_at
        FROM lead_list_entries lle
        INNER JOIN domains d ON d.id = lle.domain_id
        WHERE lle.lead_list_id = $1
        ORDER BY d.domain ASC
      `,
      [leadList.id],
    );

    return Response.json({
      leadList: {
        ...leadList,
        entries: entriesResult.rows,
      },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
