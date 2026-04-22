import { dbQuery } from "@/lib/db";

export type SignalType = "html" | "script" | "header" | "cookie" | "meta" | "dns" | "tls" | "dom" | "js";

type FingerprintRow = {
  id: string;
  technology_id: string;
  slug: string;
  technology_name: string;
  category: string;
  signal_type: SignalType;
  pattern: string;
  confidence_weight: string;
  version_capture: string | null;
  implies_json: string[];
  requires_json: string[];
  excludes_json: string[];
};

type CrawlSignalRow = {
  headers_json: Record<string, string>;
  cookies_json: string[];
  scripts_json: string[];
  meta_json: Record<string, string>;
};

type EnrichmentSignalRow = {
  dns_json: Record<string, unknown>;
  tls_json: Record<string, unknown>;
};

export type DetectionCandidate = {
  technologyId: string;
  slug: string;
  technologyName: string;
  category: string;
  score: number;
  evidence: string[];
  signalTypes: Set<SignalType>;
  implies: string[];
  requires: string[];
  excludes: string[];
  version: string | null;
  inferred?: boolean;
};

const LOW_CONFIDENCE_IGNORE_THRESHOLD = 30;

function tryMatch(pattern: string, value: string) {
  try {
    const regex = new RegExp(pattern, "i");
    return regex.test(value);
  } catch {
    return value.toLowerCase().includes(pattern.toLowerCase());
  }
}

function parseKeyedPattern(pattern: string) {
  const separatorIdx = pattern.indexOf(":");
  if (separatorIdx === -1) {
    return null;
  }

  return {
    key: pattern.slice(0, separatorIdx).trim().toLowerCase(),
    valuePattern: pattern.slice(separatorIdx + 1).trim(),
  };
}

function getDnsValues(dnsJson: Record<string, unknown>) {
  return Object.entries(dnsJson).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map((item) => `${key}:${String(item)}`);
    }
    if (typeof value === "object" && value !== null) {
      return [`${key}:${JSON.stringify(value)}`];
    }
    return [`${key}:${String(value)}`];
  });
}

function getTlsValues(tlsJson: Record<string, unknown>) {
  return Object.entries(tlsJson).map(([key, value]) => `${key}:${String(value)}`);
}

function fingerprintMatches(
  fingerprint: FingerprintRow,
  pages: CrawlSignalRow[],
  enrichment: EnrichmentSignalRow | null,
) {
  const pattern = fingerprint.pattern;

  if (fingerprint.signal_type === "script") {
    const scripts = pages.flatMap((page) => page.scripts_json ?? []);
    return scripts.some((script) => tryMatch(pattern, script));
  }

  if (fingerprint.signal_type === "meta") {
    const keyed = parseKeyedPattern(pattern);
    if (!keyed) {
      const pairs = pages.flatMap((page) =>
        Object.entries(page.meta_json ?? {}).map(([key, value]) => `${key}:${value}`),
      );
      return pairs.some((pair) => tryMatch(pattern, pair));
    }

    return pages.some((page) => {
      const value = (page.meta_json ?? {})[keyed.key];
      return value ? tryMatch(keyed.valuePattern, value) : false;
    });
  }

  if (fingerprint.signal_type === "header") {
    const keyed = parseKeyedPattern(pattern);
    if (!keyed) {
      const pairs = pages.flatMap((page) =>
        Object.entries(page.headers_json ?? {}).map(([key, value]) => `${key}:${value}`),
      );
      return pairs.some((pair) => tryMatch(pattern, pair));
    }

    return pages.some((page) => {
      const value = (page.headers_json ?? {})[keyed.key];
      return value ? tryMatch(keyed.valuePattern, value) : false;
    });
  }

  if (fingerprint.signal_type === "cookie") {
    const cookies = pages.flatMap((page) => page.cookies_json ?? []);
    return cookies.some((cookie) => tryMatch(pattern, cookie));
  }

  if (fingerprint.signal_type === "dns") {
    const dnsValues = enrichment ? getDnsValues(enrichment.dns_json ?? {}) : [];
    return dnsValues.some((value) => tryMatch(pattern, value));
  }

  if (fingerprint.signal_type === "tls") {
    const tlsValues = enrichment ? getTlsValues(enrichment.tls_json ?? {}) : [];
    return tlsValues.some((value) => tryMatch(pattern, value));
  }

  return false;
}

function ensureCandidate(map: Map<string, DetectionCandidate>, fingerprint: FingerprintRow) {
  const existing = map.get(fingerprint.technology_id);
  if (existing) {
    return existing;
  }

  const candidate: DetectionCandidate = {
    technologyId: fingerprint.technology_id,
    slug: fingerprint.slug,
    technologyName: fingerprint.technology_name,
    category: fingerprint.category,
    score: 0,
    evidence: [],
    signalTypes: new Set<SignalType>(),
    implies: fingerprint.implies_json ?? [],
    requires: fingerprint.requires_json ?? [],
    excludes: fingerprint.excludes_json ?? [],
    version: null,
  };

  map.set(fingerprint.technology_id, candidate);
  return candidate;
}

function applyBands(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function applyDependencyRules(candidates: DetectionCandidate[]) {
  const bySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));

  const filtered = candidates.filter((candidate) => {
    if (!candidate.requires.length) {
      return true;
    }

    return candidate.requires.every((requiredSlug) => {
      const required = bySlug.get(requiredSlug);
      return Boolean(required && required.score >= LOW_CONFIDENCE_IGNORE_THRESHOLD);
    });
  });

  const bySlugFiltered = new Map(filtered.map((candidate) => [candidate.slug, candidate]));

  for (const candidate of filtered) {
    for (const excludedSlug of candidate.excludes) {
      const excluded = bySlugFiltered.get(excludedSlug);
      if (!excluded) {
        continue;
      }

      if (excluded.score >= candidate.score) {
        candidate.score = Math.max(0, candidate.score - 40);
      } else {
        excluded.score = Math.max(0, excluded.score - 40);
      }
    }
  }

  const inferred: DetectionCandidate[] = [];
  for (const candidate of filtered) {
    for (const impliedSlug of candidate.implies) {
      const target = bySlugFiltered.get(impliedSlug);
      if (!target) {
        continue;
      }

      inferred.push({
        ...target,
        score: applyBands(candidate.score * 0.6),
        evidence: [`implied by ${candidate.technologyName}`],
        signalTypes: new Set(target.signalTypes),
        inferred: true,
      });
    }
  }

  return [...filtered, ...inferred];
}

export function calculateConfidenceBands(candidates: DetectionCandidate[]) {
  return candidates
    .map((candidate) => {
      let score = applyBands(candidate.score);
      if (candidate.signalTypes.size >= 3) {
        score = applyBands(score + 15);
      } else if (candidate.signalTypes.size >= 2) {
        score = applyBands(score + 10);
      }
      return {
        ...candidate,
        score,
      };
    })
    .filter((candidate) => candidate.score >= LOW_CONFIDENCE_IGNORE_THRESHOLD)
    .map((candidate) => ({
      ...candidate,
      band: candidate.score >= 85 ? "high" : candidate.score >= 60 ? "medium" : "low",
    }));
}

export async function runFingerprintDetection(domainId: string, crawlJobId: string) {
  const pagesResult = await dbQuery<CrawlSignalRow>(
    `
      SELECT headers_json, cookies_json, scripts_json, meta_json
      FROM crawl_pages
      WHERE crawl_job_id = $1
    `,
    [crawlJobId],
  );

  const enrichmentResult = await dbQuery<EnrichmentSignalRow>(
    `
      SELECT dns_json, tls_json
      FROM enrichments
      WHERE crawl_job_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [crawlJobId],
  );

  const fingerprintsResult = await dbQuery<FingerprintRow>(
    `
      SELECT
        f.id,
        f.technology_id,
        t.slug,
        t.name AS technology_name,
        t.category,
        f.signal_type,
        f.pattern,
        f.confidence_weight,
        f.version_capture,
        f.implies_json,
        f.requires_json,
        f.excludes_json
      FROM fingerprints f
      INNER JOIN technologies t ON t.id = f.technology_id
      WHERE f.active = TRUE
    `,
  );

  const pages = pagesResult.rows;
  const enrichment = enrichmentResult.rows[0] ?? null;
  const candidatesByTech = new Map<string, DetectionCandidate>();

  for (const fingerprint of fingerprintsResult.rows) {
    const matched = fingerprintMatches(fingerprint, pages, enrichment);
    if (!matched) {
      continue;
    }

    const candidate = ensureCandidate(candidatesByTech, fingerprint);
    const weight = Number(fingerprint.confidence_weight);
    const addScore = Number.isFinite(weight) ? weight * 100 : 0;
    candidate.score += addScore;
    candidate.signalTypes.add(fingerprint.signal_type);
    candidate.evidence.push(`${fingerprint.signal_type}:${fingerprint.pattern}`);
  }

  for (const candidate of candidatesByTech.values()) {
    if (candidate.signalTypes.size >= 3) {
      candidate.score += 15;
    } else if (candidate.signalTypes.size >= 2) {
      candidate.score += 10;
    }
    candidate.score = applyBands(candidate.score);
  }

  const withDependencies = applyDependencyRules([...candidatesByTech.values()])
    .map((candidate) => ({ ...candidate, score: applyBands(candidate.score) }))
    .filter((candidate) => candidate.score >= LOW_CONFIDENCE_IGNORE_THRESHOLD);

  await dbQuery(
    `
      UPDATE detections
      SET is_current = FALSE
      WHERE domain_id = $1
        AND is_current = TRUE
    `,
    [domainId],
  );

  for (const candidate of withDependencies) {
    await dbQuery(
      `
        INSERT INTO detections (
          domain_id,
          crawl_job_id,
          technology_id,
          confidence,
          version,
          matched_signals_json,
          first_seen_at,
          last_seen_at,
          is_current
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW(), TRUE)
      `,
      [
        domainId,
        crawlJobId,
        candidate.technologyId,
        candidate.score,
        candidate.version,
        JSON.stringify({
          evidence: candidate.evidence,
          inferred: candidate.inferred ?? false,
          confidenceBand:
            candidate.score >= 85 ? "high" : candidate.score >= 60 ? "medium" : "low",
        }),
      ],
    );
  }

  return withDependencies.map((candidate) => ({
    technologyId: candidate.technologyId,
    slug: candidate.slug,
    confidence: candidate.score,
  }));
}
