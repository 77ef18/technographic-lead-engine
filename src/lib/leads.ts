import { dbQuery } from "@/lib/db";

export type LeadFilter = {
  hasTech?: string;
  techCategory?: string;
  minConfidence?: number;
  lastScannedAfter?: string;
  country?: string;
  language?: string;
};

export type LeadRow = {
  domain_id: string;
  domain: string;
  status: string;
  latest_scan_at: string | null;
  language: string | null;
  country: string | null;
  region: string | null;
  technologies: string[];
  top_confidence: number | null;
};

export async function queryLeads(filter: LeadFilter, limit = 200, offset = 0) {
  const where: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filter.hasTech) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM detections d
        INNER JOIN technologies t ON t.id = d.technology_id
        WHERE d.domain_id = dm.id
          AND d.is_current = TRUE
          AND t.slug = $${idx}
      )
    `);
    values.push(filter.hasTech);
    idx += 1;
  }

  if (filter.techCategory) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM detections d
        INNER JOIN technologies t ON t.id = d.technology_id
        WHERE d.domain_id = dm.id
          AND d.is_current = TRUE
          AND t.category = $${idx}
      )
    `);
    values.push(filter.techCategory);
    idx += 1;
  }

  if (filter.minConfidence !== undefined) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM detections d
        WHERE d.domain_id = dm.id
          AND d.is_current = TRUE
          AND d.confidence >= $${idx}
      )
    `);
    values.push(filter.minConfidence);
    idx += 1;
  }

  if (filter.lastScannedAfter) {
    where.push(`latest_enrichment.created_at >= $${idx}`);
    values.push(filter.lastScannedAfter);
    idx += 1;
  }

  if (filter.country) {
    where.push(`COALESCE(latest_enrichment.country, '') ILIKE $${idx}`);
    values.push(filter.country);
    idx += 1;
  }

  if (filter.language) {
    where.push(`COALESCE(latest_enrichment.language, '') ILIKE $${idx}`);
    values.push(filter.language);
    idx += 1;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  values.push(limit, offset);

  const result = await dbQuery<LeadRow>(
    `
      SELECT
        dm.id AS domain_id,
        dm.domain,
        dm.status,
        latest_enrichment.created_at AS latest_scan_at,
        latest_enrichment.language,
        latest_enrichment.country,
        latest_enrichment.region,
        COALESCE(array_agg(DISTINCT tech.slug) FILTER (WHERE tech.slug IS NOT NULL), '{}') AS technologies,
        MAX(det.confidence) AS top_confidence
      FROM domains dm
      LEFT JOIN LATERAL (
        SELECT *
        FROM enrichments e
        WHERE e.domain_id = dm.id
        ORDER BY e.created_at DESC
        LIMIT 1
      ) AS latest_enrichment ON TRUE
      LEFT JOIN detections det
        ON det.domain_id = dm.id
       AND det.is_current = TRUE
      LEFT JOIN technologies tech
        ON tech.id = det.technology_id
      ${whereClause}
      GROUP BY dm.id, latest_enrichment.created_at, latest_enrichment.language, latest_enrichment.country, latest_enrichment.region
      ORDER BY COALESCE(latest_enrichment.created_at, dm.created_at) DESC
      LIMIT $${idx}
      OFFSET $${idx + 1}
    `,
    values,
  );

  return result.rows;
}
