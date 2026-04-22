import { dbQuery } from "@/lib/db";

export default async function LeadListsPage() {
  const result = await dbQuery<{
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    entries_count: string;
  }>(
    `
      SELECT
        ll.id,
        ll.name,
        ll.created_at,
        ll.updated_at,
        COUNT(lle.id)::text AS entries_count
      FROM lead_lists ll
      LEFT JOIN lead_list_entries lle ON lle.lead_list_id = ll.id
      GROUP BY ll.id
      ORDER BY ll.updated_at DESC
    `,
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Lead Lists</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Build lists in <a className="underline" href="/lead-builder">Lead Builder</a>.
      </p>
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Entries</th>
                <th className="py-2 pr-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4">
                    <a className="underline" href={`/lead-lists/${row.id}`}>
                      {row.name}
                    </a>
                  </td>
                  <td className="py-2 pr-4">{Number(row.entries_count)}</td>
                  <td className="py-2 pr-4">{row.updated_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
