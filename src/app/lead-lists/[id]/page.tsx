import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { dbQuery } from "@/lib/db";
import { queryLeads } from "@/lib/leads";

async function refreshList(formData: FormData) {
  "use server";

  const leadListId = String(formData.get("leadListId") ?? "");
  if (!leadListId) {
    return;
  }

  const listResult = await dbQuery<{ id: string; filter_json: Record<string, unknown> }>(
    `
      SELECT id, filter_json
      FROM lead_lists
      WHERE id = $1
      LIMIT 1
    `,
    [leadListId],
  );
  const leadList = listResult.rows[0];
  if (!leadList) {
    return;
  }

  const leads = await queryLeads(leadList.filter_json, 1000, 0);
  await dbQuery(`DELETE FROM lead_list_entries WHERE lead_list_id = $1`, [leadListId]);
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
  await dbQuery(`UPDATE lead_lists SET updated_at = NOW() WHERE id = $1`, [leadListId]);

  revalidatePath(`/lead-lists/${leadListId}`);
}

export default async function LeadListDetailPage(props: PageProps<"/lead-lists/[id]">) {
  const { id } = await props.params;
  const listResult = await dbQuery<{
    id: string;
    name: string;
    filter_json: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT id, name, filter_json, created_at, updated_at
      FROM lead_lists
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );
  const leadList = listResult.rows[0];
  if (!leadList) {
    notFound();
  }

  const entries = await dbQuery<{ domain: string; added_at: string }>(
    `
      SELECT d.domain, lle.added_at
      FROM lead_list_entries lle
      INNER JOIN domains d ON d.id = lle.domain_id
      WHERE lle.lead_list_id = $1
      ORDER BY d.domain ASC
    `,
    [leadList.id],
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">{leadList.name}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Updated {leadList.updated_at} • {entries.rows.length} entries
      </p>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Filter</h2>
        <pre className="overflow-x-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
          {JSON.stringify(leadList.filter_json, null, 2)}
        </pre>
      </section>

      <section className="flex flex-wrap gap-2">
        <form action={refreshList}>
          <input type="hidden" name="leadListId" value={leadList.id} />
          <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Refresh list
          </button>
        </form>
        <a
          href={`/api/lead-lists/${leadList.id}/export.csv`}
          className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          Export CSV
        </a>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Entries</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Added at</th>
              </tr>
            </thead>
            <tbody>
              {entries.rows.map((entry) => (
                <tr key={entry.domain} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4">{entry.domain}</td>
                  <td className="py-2 pr-4">{entry.added_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
