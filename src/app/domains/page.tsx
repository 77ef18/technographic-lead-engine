import { revalidatePath } from "next/cache";

import { dbQuery } from "@/lib/db";
import { normalizeDomain } from "@/lib/domain";

async function addDomain(formData: FormData) {
  "use server";

  const rawDomain = String(formData.get("domain") ?? "");
  const status = String(formData.get("status") ?? "active");
  if (!rawDomain) {
    return;
  }

  const normalized = normalizeDomain(rawDomain);
  await dbQuery(
    `
      INSERT INTO domains (domain, status)
      VALUES ($1, $2)
      ON CONFLICT (domain) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [normalized, status],
  );
  revalidatePath("/domains");
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
}

export default async function DomainsPage() {
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

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Add domain</h2>
        <form action={addDomain} className="flex flex-wrap gap-2">
          <input
            name="domain"
            placeholder="example.com"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
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
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4">
                    <a className="underline" href={`/domains/${row.id}`}>
                      {row.domain}
                    </a>
                  </td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2 pr-4">{row.last_scan_at ?? "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
