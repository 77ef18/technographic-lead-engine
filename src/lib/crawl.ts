import crypto from "node:crypto";
import dns from "node:dns/promises";
import tls from "node:tls";

import { load } from "cheerio";

import { dbQuery } from "@/lib/db";
import { runFingerprintDetection } from "@/lib/fingerprint";
import { logEvent } from "@/lib/log";

const CRAWL_PATHS = ["/", "/about", "/pricing", "/blog"];
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS_PER_PAGE = 2;
const MAX_PAGES = 4;
const TLS_TIMEOUT_MS = 6_000;

type CrawlDomain = {
  id: string;
  domain: string;
};

type CrawlSummary = {
  pagesAttempted: number;
  pagesStored: number;
  baseUrl: string;
};

type FetchResult = {
  url: string;
  statusCode: number;
  responseTimeMs: number;
  headers: Record<string, string>;
  cookies: string[];
  scripts: string[];
  meta: Record<string, string>;
  htmlHash: string | null;
  html: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHeaderMap(headers: Headers) {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function extractCookies(headers: Headers) {
  const combined = headers.get("set-cookie");
  if (!combined) {
    return [];
  }

  return combined
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractSignals(html: string) {
  if (!html) {
    return {
      scripts: [],
      meta: {},
      title: null,
      description: null,
      language: null,
      social: {
        linkedin: null,
        x: null,
        facebook: null,
      },
    };
  }

  const $ = load(html);
  const scripts = $("script[src]")
    .map((_, el) => ($(el).attr("src") ?? "").trim())
    .get()
    .filter(Boolean);

  const meta: Record<string, string> = {};
  $("meta").each((_, el) => {
    const key = ($(el).attr("name") ?? $(el).attr("property") ?? "").trim().toLowerCase();
    const content = ($(el).attr("content") ?? "").trim();
    if (key && content) {
      meta[key] = content;
    }
  });

  const links = $("a[href]")
    .map((_, el) => ($(el).attr("href") ?? "").trim())
    .get();

  const social = {
    linkedin: links.find((href) => href.includes("linkedin.com")) ?? null,
    x: links.find((href) => href.includes("x.com") || href.includes("twitter.com")) ?? null,
    facebook: links.find((href) => href.includes("facebook.com")) ?? null,
  };

  const title = $("title").first().text().trim() || null;
  const description = meta.description ?? meta["og:description"] ?? null;
  const language = ($("html").attr("lang") ?? meta["content-language"] ?? "").trim() || null;

  return {
    scripts,
    meta,
    title,
    description,
    language,
    social,
  };
}

function hashHtml(html: string) {
  if (!html) {
    return null;
  }

  return crypto.createHash("sha256").update(html).digest("hex");
}

async function safeResolveDns(domain: string) {
  const output: Record<string, unknown> = {};

  const tasks: Array<[string, Promise<unknown>]> = [
    ["a", dns.resolve4(domain)],
    ["aaaa", dns.resolve6(domain)],
    ["mx", dns.resolveMx(domain)],
    ["ns", dns.resolveNs(domain)],
    ["txt", dns.resolveTxt(domain)],
  ];

  for (const [key, task] of tasks) {
    try {
      const value = await task;
      output[key] = value;
    } catch {
      output[key] = [];
    }
  }

  return output;
}

async function safeReadTls(domain: string) {
  return new Promise<Record<string, unknown>>((resolve) => {
    const socket = tls.connect(
      {
        host: domain,
        port: 443,
        servername: domain,
        rejectUnauthorized: false,
        timeout: TLS_TIMEOUT_MS,
      },
      () => {
        const cert = socket.getPeerCertificate();
        resolve({
          subject: cert?.subject ?? null,
          issuer: cert?.issuer ?? null,
          valid_from: cert?.valid_from ?? null,
          valid_to: cert?.valid_to ?? null,
          subjectaltname: cert?.subjectaltname ?? null,
        });
        socket.end();
      },
    );

    socket.on("error", () => resolve({}));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({});
    });
  });
}

async function fetchOne(url: string): Promise<FetchResult> {
  const start = Date.now();
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "user-agent": "TechnographicLeadEngine/0.1 (+public-prospecting-crawler)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  const responseTimeMs = Date.now() - start;
  const contentType = response.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");
  const html = isHtml ? await response.text() : "";
  const signalData = extractSignals(html);

  return {
    url: response.url,
    statusCode: response.status,
    responseTimeMs,
    headers: normalizeHeaderMap(response.headers),
    cookies: extractCookies(response.headers),
    scripts: signalData.scripts,
    meta: signalData.meta,
    htmlHash: hashHtml(html),
    html,
  };
}

async function fetchWithRetry(url: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PAGE; attempt += 1) {
    try {
      return await fetchOne(url);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS_PER_PAGE) {
        await wait(250 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError;
}

async function updateJobStatus(
  jobId: string,
  status: "running" | "succeeded" | "failed" | "retrying",
  fields: { errorMessage?: string | null; started?: boolean; finished?: boolean } = {},
) {
  const setParts = ["status = $2"];
  const values: unknown[] = [jobId, status];

  if (fields.started) {
    setParts.push("started_at = NOW()");
  }

  if (fields.finished) {
    setParts.push("finished_at = NOW()");
  }

  if (Object.prototype.hasOwnProperty.call(fields, "errorMessage")) {
    setParts.push(`error_message = $${values.length + 1}`);
    values.push(fields.errorMessage ?? null);
  }

  await dbQuery(
    `
      UPDATE crawl_jobs
      SET ${setParts.join(", ")}
      WHERE id = $1
    `,
    values,
  );
}

async function markJobFailure(jobId: string, message: string) {
  const attemptsResult = await dbQuery<{ attempts: number }>(
    `
      SELECT attempts
      FROM crawl_jobs
      WHERE id = $1
      LIMIT 1
    `,
    [jobId],
  );
  const attempts = attemptsResult.rows[0]?.attempts ?? 1;
  const retryCap = 3;

  if (attempts >= retryCap) {
    await dbQuery(`UPDATE crawl_jobs SET attempts = attempts + 1 WHERE id = $1`, [jobId]);
    await updateJobStatus(jobId, "failed", {
      finished: true,
      errorMessage: `[dead-letter] ${message}`,
    });
    return;
  }

  await dbQuery(`UPDATE crawl_jobs SET attempts = attempts + 1 WHERE id = $1`, [jobId]);
  await updateJobStatus(jobId, "retrying", {
    finished: true,
    errorMessage: message,
  });
}

function getBaseCandidates(domain: string) {
  return [`https://${domain}`, `http://${domain}`];
}

export async function executeCrawlJob(jobId: string, domain: CrawlDomain): Promise<CrawlSummary> {
  await updateJobStatus(jobId, "running", { started: true, errorMessage: null });
  logEvent("info", "crawl_job_started", { crawl_job_id: jobId, domain_id: domain.id, domain: domain.domain });

  try {
    let baseUrl = "";
    let homepage: FetchResult | null = null;
    let lastBaseError: unknown;

    for (const candidate of getBaseCandidates(domain.domain)) {
      try {
        const result = await fetchWithRetry(candidate);
        homepage = result;
        baseUrl = new URL(result.url).origin;
        break;
      } catch (error) {
        lastBaseError = error;
      }
    }

    if (!homepage || !baseUrl) {
      throw new Error(`Failed to fetch domain root: ${String(lastBaseError)}`);
    }

    const pageResults: FetchResult[] = [homepage];
    const extraPaths = CRAWL_PATHS.slice(1, MAX_PAGES);

    for (const pagePath of extraPaths) {
      const pageUrl = `${baseUrl}${pagePath}`;
      try {
        const result = await fetchWithRetry(pageUrl);
        pageResults.push(result);
      } catch {
        // Skip failed auxiliary page; other pages can still provide useful signals.
      }
    }

    for (const page of pageResults) {
      await dbQuery(
        `
          INSERT INTO crawl_pages (
            crawl_job_id,
            url,
            status_code,
            response_time_ms,
            html_hash,
            headers_json,
            cookies_json,
            scripts_json,
            meta_json
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
        `,
        [
          jobId,
          page.url,
          page.statusCode,
          page.responseTimeMs,
          page.htmlHash,
          JSON.stringify(page.headers),
          JSON.stringify(page.cookies),
          JSON.stringify(page.scripts),
          JSON.stringify(page.meta),
        ],
      );
    }

    const homeSignals = extractSignals(homepage.html);
    const dnsData = await safeResolveDns(domain.domain);
    const tlsData = await safeReadTls(domain.domain);
    await dbQuery(
      `
        INSERT INTO enrichments (
          domain_id,
          crawl_job_id,
          title,
          description,
          language,
          linkedin_url,
          x_url,
          facebook_url,
          dns_json,
          tls_json,
          raw_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
      `,
      [
        domain.id,
        jobId,
        homeSignals.title,
        homeSignals.description,
        homeSignals.language,
        homeSignals.social.linkedin,
        homeSignals.social.x,
        homeSignals.social.facebook,
        JSON.stringify(dnsData),
        JSON.stringify(tlsData),
        JSON.stringify({
          pagesAttempted: CRAWL_PATHS.length,
          pagesStored: pageResults.length,
          crawledAt: new Date().toISOString(),
        }),
      ],
    );

    await runFingerprintDetection(domain.id, jobId);

    await updateJobStatus(jobId, "succeeded", { finished: true });
    logEvent("info", "crawl_job_succeeded", {
      crawl_job_id: jobId,
      domain_id: domain.id,
      pages_stored: pageResults.length,
    });

    return {
      pagesAttempted: CRAWL_PATHS.length,
      pagesStored: pageResults.length,
      baseUrl,
    };
  } catch (error) {
    await markJobFailure(jobId, String(error));
    logEvent("error", "crawl_job_failed", {
      crawl_job_id: jobId,
      domain_id: domain.id,
      error: String(error),
    });
    throw error;
  }
}
