import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";
import { queryLeads } from "@/lib/leads";

type LeadListRow = {
  id: string;
  owner_id: string;
  filter_json: {
    hasTech?: string;
    techCategory?: string;
    minConfidence?: number;
    lastScannedAfter?: string;
    country?: string;
    language?: string;
  };
};

export async function POST(
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
    const listResult = await dbQuery<LeadListRow>(
      `
        SELECT id, owner_id, filter_json
        FROM lead_lists
        WHERE id = $1
        LIMIT 1
      `,
      [parsedId.data],
    );
    const leadList = listResult.rows[0];
    if (!leadList || leadList.owner_id !== auth.ownerId) {
      return jsonError("Lead list not found.", 404);
    }

    const leads = await queryLeads(leadList.filter_json ?? {}, 1000, 0);

    await dbQuery(`DELETE FROM lead_list_entries WHERE lead_list_id = $1`, [leadList.id]);
    for (const lead of leads) {
      await dbQuery(
        `
          INSERT INTO lead_list_entries (lead_list_id, domain_id)
          VALUES ($1, $2)
          ON CONFLICT (lead_list_id, domain_id) DO NOTHING
        `,
        [leadList.id, lead.domain_id],
      );
    }

    await dbQuery(`UPDATE lead_lists SET updated_at = NOW() WHERE id = $1`, [leadList.id]);

    return Response.json({ refreshed: true, entriesCount: leads.length });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
