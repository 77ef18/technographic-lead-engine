import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { executeCrawlJob } from "@/lib/crawl";
import { dbQuery } from "@/lib/db";
import { normalizeDomain } from "@/lib/domain";

async function addDomain(formData: FormData) {
  "use server";

  const rawDomain = String(formData.get("domain") ?? "");
  const targetUrlRaw = String(formData.get("targetUrl") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  if (!rawDomain) {
    redirect("/domains?error=empty_domain");
  }

  let normalized = "";
  try {
    normalized = normalizeDomain(rawDomain);
  } catch {
    redirect("/domains?error=invalid_domain");
  }

  const result = await dbQuery<{ id: string; domain: string }>(
    `
      INSERT INTO domains (domain, status)
      VALUES ($1, $2)
      ON CONFLICT (domain) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id, domain
    `,
    [normalized, status],
  );

  if (targetUrlRaw) {
    const savedDomain = result.rows[0];
    const jobResult = await dbQuery<{ id: string }>(
      `
        INSERT INTO crawl_jobs (domain_id, trigger, status, attempts)
        VALUES ($1, 'manual', 'queued', 1)
        RETURNING id
      `,
      [savedDomain.id],
    );
    await executeCrawlJob(jobResult.rows[0].id, savedDomain, {
      seedUrl: targetUrlRaw,
    });
  }
  revalidatePath("/domains");
  redirect(
    `/domains?notice=domain_saved&domain=${encodeURIComponent(normalized)}${targetUrlRaw ? "&scanned=1" : ""}`,
  );
}

async function importCsv(formData: FormData) {
  "use server";

  const csv = String(formData.get("csv") ?? "");
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter(Boolean);
  for (const line of lines) {
    try {
      const normalized = normalizeDomain(line);
      await dbQuery(
        `
          INSERT INTO domains (domain, status)
          VALUES ($1, 'active')
          ON CONFLICT (domain) DO NOTHING
        `,
        [normalized],
      );
    } catch {
      // Ignore invalid row in UI quick import.
    }
  }
  revalidatePath("/domains");
  redirect(`/domains?notice=csv_imported&count=${lines.length}`);
}

async function triggerScan(formData: FormData) {
  "use server";

  const domainId = String(formData.get("domainId") ?? "");
  if (!domainId) {
    return;
  }

  const result = await dbQuery<{ id: string; domain: string }>(
    `
      SELECT id, domain
      FROM domains
      WHERE id = $1
      LIMIT 1
    `,
    [domainId],
  );

  const domain = result.rows[0];
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
  revalidatePath("/domains");
  revalidatePath(`/domains/${domain.id}`);
}

export default async function DomainsPage(props: PageProps<"/domains">) {
  const formatDate = (value: unknown, fallback = "never") => {
    if (!value) {
      return fallback;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  };
  const searchParams = await props.searchParams;
  const error = searchParams.error ? String(searchParams.error) : "";
  const notice = searchParams.notice ? String(searchParams.notice) : "";
  const noticeDomain = searchParams.domain ? String(searchParams.domain) : "";
  const importedCount = searchParams.count ? String(searchParams.count) : "";
  const scanned = searchParams.scanned ? String(searchParams.scanned) : "";

  const result = await dbQuery<{
    id: string;
    domain: string;
    status: string;
    last_scan_at: string | null;
  }>(
    `
      SELECT
        d.id,
        d.domain,
        d.status,
        latest.created_at AS last_scan_at
      FROM domains d
      LEFT JOIN LATERAL (
        SELECT created_at
        FROM enrichments e
        WHERE e.domain_id = d.id
        ORDER BY created_at DESC
        LIMIT 1
      ) latest ON TRUE
      ORDER BY d.created_at DESC
      LIMIT 500
    `,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Domains</h1>

      {error ? (
        <section className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error === "empty_domain" ? "Please enter a domain before clicking Add." : null}
          {error === "invalid_domain" ? "That domain format looks invalid. Try values like example.com." : null}
        </section>
      ) : null}

      {notice ? (
        <section className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {notice === "domain_saved" ? `Saved domain: ${noticeDomain}` : null}
          {notice === "domain_saved" && scanned === "1" ? " and started a targeted crawl." : null}
          {notice === "csv_imported" ? `Imported ${importedCount || "0"} CSV row(s).` : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Add domain</h2>
        <form action={addDomain} className="flex flex-wrap gap-2">
          <input
            name="domain"
            placeholder="example.com"
            required
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <input
            type="url"
            name="targetUrl"
            placeholder="Optional page URL to crawl immediately"
            className="w-72 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <select
            name="status"
            defaultValue="active"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="archived">archived</option>
          </select>
          <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Add
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Import CSV</h2>
        <form action={importCsv} className="space-y-2">
          <textarea
            name="csv"
            rows={4}
            placeholder="domain.com&#10;another.com"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Import
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Tracked domains</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last scan</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4">
                    <Link className="underline" href={`/domains/${row.id}`}>
                      {row.domain}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2 pr-4">{formatDate(row.last_scan_at)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/domains/${row.id}`}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                      >
                        Open
                      </Link>
                      <form action={triggerScan}>
                        <input type="hidden" name="domainId" value={row.id} />
                        <button className="rounded bg-black px-2 py-1 text-xs text-white dark:bg-white dark:text-black">
                          Scan now
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
