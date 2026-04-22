import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { executeCrawlJob } from "@/lib/crawl";
import { dbQuery } from "@/lib/db";

async function triggerScan(formData: FormData) {
  "use server";

  const domainId = String(formData.get("domainId") ?? "");
  if (!domainId) {
    return;
  }

  const domainResult = await dbQuery<{ id: string; domain: string }>(
    `
      SELECT id, domain
      FROM domains
      WHERE id = $1
      LIMIT 1
    `,
    [domainId],
  );
  const domain = domainResult.rows[0];
  if (!domain) {
    return;
  }

  const jobResult = await dbQuery<{ id: string }>(
    `
      INSERT INTO crawl_jobs (domain_id, trigger, status, attempts)
      VALUES ($1, 'manual', 'queued', 1)
      RETURNING id
    `,
    [domain.id],
  );

  await executeCrawlJob(jobResult.rows[0].id, domain);
  revalidatePath(`/domains/${domainId}`);
  revalidatePath("/domains");
}

export default async function DomainDetailPage(props: PageProps<"/domains/[id]">) {
  const { id } = await props.params;

  const domainResult = await dbQuery<{ id: string; domain: string; status: string }>(
    `
      SELECT id, domain, status
      FROM domains
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );
  const domain = domainResult.rows[0];
  if (!domain) {
    notFound();
  }

  const [detections, enrichment, history] = await Promise.all([
    dbQuery<{
      technology: string;
      category: string;
      confidence: number;
      matched_signals_json: { evidence?: string[] };
      is_current: boolean;
    }>(
      `
        SELECT t.name AS technology, t.category, d.confidence, d.matched_signals_json, d.is_current
        FROM detections d
        INNER JOIN technologies t ON t.id = d.technology_id
        WHERE d.domain_id = $1
        ORDER BY d.is_current DESC, d.confidence DESC
      `,
      [domain.id],
    ),
    dbQuery<{
      title: string | null;
      description: string | null;
      language: string | null;
      country: string | null;
      region: string | null;
      linkedin_url: string | null;
      x_url: string | null;
      facebook_url: string | null;
      created_at: string;
    }>(
      `
        SELECT title, description, language, country, region, linkedin_url, x_url, facebook_url, created_at
        FROM enrichments
        WHERE domain_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [domain.id],
    ),
    dbQuery<{
      id: string;
      status: string;
      trigger: string;
      attempts: number;
      created_at: string;
      error_message: string | null;
    }>(
      `
        SELECT id, status, trigger, attempts, created_at, error_message
        FROM crawl_jobs
        WHERE domain_id = $1
        ORDER BY created_at DESC
        LIMIT 30
      `,
      [domain.id],
    ),
  ]);

  const latestEnrichment = enrichment.rows[0];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{domain.domain}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Status: {domain.status}</p>
        </div>
        <form action={triggerScan}>
          <input type="hidden" name="domainId" value={domain.id} />
          <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Trigger scan
          </button>
        </form>
      </div>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Detections</h2>
        <div className="space-y-2 text-sm">
          {detections.rows.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-300">No detections yet.</p>
          ) : (
            detections.rows.map((row, index) => (
              <div key={`${row.technology}-${index}`} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
                <div className="flex gap-3">
                  <span className="font-medium">{row.technology}</span>
                  <span className="text-zinc-500">({row.category})</span>
                  <span>confidence {row.confidence}</span>
                  <span>{row.is_current ? "current" : "historical"}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  evidence: {(row.matched_signals_json?.evidence ?? []).slice(0, 3).join(", ")}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Enrichment</h2>
        {latestEnrichment ? (
          <div className="grid gap-2 text-sm">
            <div>Title: {latestEnrichment.title ?? "-"}</div>
            <div>Description: {latestEnrichment.description ?? "-"}</div>
            <div>Language: {latestEnrichment.language ?? "-"}</div>
            <div>
              Location: {[latestEnrichment.country, latestEnrichment.region].filter(Boolean).join(" / ") || "-"}
            </div>
            <div>LinkedIn: {latestEnrichment.linkedin_url ?? "-"}</div>
            <div>X: {latestEnrichment.x_url ?? "-"}</div>
            <div>Facebook: {latestEnrichment.facebook_url ?? "-"}</div>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">No enrichment snapshot yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Scan history</h2>
        <div className="space-y-2 text-sm">
          {history.rows.map((job) => (
            <div key={job.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-700">
              <div>
                {job.created_at} - {job.status} ({job.trigger}, attempts {job.attempts})
              </div>
              {job.error_message ? <div className="text-xs text-red-500">{job.error_message}</div> : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
