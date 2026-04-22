import type { NextRequest } from "next/server";
import { z } from "zod";

import { authenticateApiKey } from "@/lib/auth";
import { dbQuery } from "@/lib/db";
import { isDatabaseUnavailable } from "@/lib/db-error";
import { jsonError } from "@/lib/http";

type CsvRow = {
  domain: string;
  status: string;
  language: string | null;
  country: string | null;
  region: string | null;
  latest_scan_at: string | null;
  technologies: string[];
};

function toCsvValue(value: string | null) {
  if (value === null) {
    return "";
  }
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

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
    const listResult = await dbQuery<{ id: string; owner_id: string }>(
      `
        SELECT id, owner_id
        FROM lead_lists
        WHERE id = $1
        LIMIT 1
      `,
      [parsedId.data],
    );
    const list = listResult.rows[0];
    if (!list || list.owner_id !== auth.ownerId) {
      return jsonError("Lead list not found.", 404);
    }

    const rowsResult = await dbQuery<CsvRow>(
      `
        SELECT
          d.domain,
          d.status,
          e.language,
          e.country,
          e.region,
          e.created_at AS latest_scan_at,
          COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), '{}') AS technologies
        FROM lead_list_entries lle
        INNER JOIN domains d ON d.id = lle.domain_id
        LEFT JOIN LATERAL (
          SELECT *
          FROM enrichments en
          WHERE en.domain_id = d.id
          ORDER BY en.created_at DESC
          LIMIT 1
        ) e ON TRUE
        LEFT JOIN detections det ON det.domain_id = d.id AND det.is_current = TRUE
        LEFT JOIN technologies t ON t.id = det.technology_id
        WHERE lle.lead_list_id = $1
        GROUP BY d.id, e.language, e.country, e.region, e.created_at
        ORDER BY d.domain ASC
      `,
      [list.id],
    );

    const header = "domain,status,language,country,region,latest_scan_at,technologies";
    const lines = rowsResult.rows.map((row) =>
      [
        toCsvValue(row.domain),
        toCsvValue(row.status),
        toCsvValue(row.language),
        toCsvValue(row.country),
        toCsvValue(row.region),
        toCsvValue(row.latest_scan_at),
        toCsvValue((row.technologies ?? []).join("|")),
      ].join(","),
    );
    const csv = [header, ...lines].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="lead-list-${list.id}.csv"`,
      },
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Database unavailable. Ensure Postgres is running and DATABASE_URL is correct.", 503);
    }
    throw error;
  }
}
