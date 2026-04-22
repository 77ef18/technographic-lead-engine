import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";
import { queryLeads } from "@/lib/leads";

const createLeadListSchema = z.object({
  name: z.string().min(1).max(120),
  filter: z
    .object({
      hasTech: z.string().optional(),
      techCategory: z.string().optional(),
      minConfidence: z.number().min(0).max(100).optional(),
      lastScannedAfter: z.string().optional(),
      country: z.string().optional(),
      language: z.string().optional(),
    })
    .default({}),
});

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  try {
    const result = await dbQuery(
      `
        SELECT id, owner_id, name, filter_json, created_at, updated_at
        FROM lead_lists
        WHERE owner_id = $1
        ORDER BY updated_at DESC
      `,
      [auth.ownerId],
    );
    return Response.json({ leadLists: result.rows });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return jsonError(auth.error, auth.status);
  }

  const body = await request.json().catch(() => null);
  const parsed = createLeadListSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, { details: parsed.error.flatten() });
  }

  try {
    const listResult = await dbQuery<{ id: string }>(
      `
        INSERT INTO lead_lists (owner_id, name, filter_json)
        VALUES ($1, $2, $3::jsonb)
        RETURNING id
      `,
      [auth.ownerId, parsed.data.name, JSON.stringify(parsed.data.filter)],
    );

    const leadListId = listResult.rows[0].id;
    const leads = await queryLeads(parsed.data.filter, 500, 0);

    for (const lead of leads) {
      await dbQuery(
        `
          INSERT INTO lead_list_entries (lead_list_id, domain_id)
          VALUES ($1, $2)
          ON CONFLICT (lead_list_id, domain_id) DO NOTHING
        `,
        [leadListId, lead.domain_id],
      );
    }

    return Response.json(
      {
        leadListId,
        entriesAdded: leads.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
