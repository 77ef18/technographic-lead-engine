import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dbQuery } from "@/lib/db";
import { queryLeads } from "@/lib/leads";

async function saveLeadList(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return;
  }

  const filter = {
    hasTech: String(formData.get("hasTech") ?? "").trim() || undefined,
    techCategory: String(formData.get("techCategory") ?? "").trim() || undefined,
    minConfidence: formData.get("minConfidence")
      ? Number(String(formData.get("minConfidence") ?? ""))
      : undefined,
    country: String(formData.get("country") ?? "").trim() || undefined,
    language: String(formData.get("language") ?? "").trim() || undefined,
  };

  const listResult = await dbQuery<{ id: string }>(
    `
      INSERT INTO lead_lists (owner_id, name, filter_json)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id
    `,
    ["00000000-0000-0000-0000-000000000000", name, JSON.stringify(filter)],
  );
  const leadListId = listResult.rows[0].id;

  const leads = await queryLeads(filter, 1000, 0);
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

  revalidatePath("/lead-builder");
  revalidatePath(`/lead-lists/${leadListId}`);
  redirect(`/lead-lists/${leadListId}`);
}

export default async function LeadBuilderPage(props: PageProps<"/lead-builder">) {
  const searchParams = await props.searchParams;
  const hasTech = searchParams.hasTech ? String(searchParams.hasTech) : undefined;
  const techCategory = searchParams.techCategory ? String(searchParams.techCategory) : undefined;
  const minConfidence = searchParams.minConfidence ? Number(searchParams.minConfidence) : undefined;
  const country = searchParams.country ? String(searchParams.country) : undefined;
  const language = searchParams.language ? String(searchParams.language) : undefined;

  const leads = await queryLeads(
    { hasTech, techCategory, minConfidence, country, language },
    300,
    0,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Lead Builder</h1>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Filter</h2>
        <form className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <input
            name="hasTech"
            placeholder="tech slug"
            defaultValue={hasTech}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <input
            name="techCategory"
            placeholder="category"
            defaultValue={techCategory}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <input
            name="minConfidence"
            placeholder="min confidence"
            defaultValue={minConfidence}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <input
            name="country"
            placeholder="country"
            defaultValue={country}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <input
            name="language"
            placeholder="language"
            defaultValue={language}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Apply
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Preview ({leads.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-4">Domain</th>
                <th className="py-2 pr-4">Tech</th>
                <th className="py-2 pr-4">Top confidence</th>
                <th className="py-2 pr-4">Geo/Language</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.domain_id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-4">{lead.domain}</td>
                  <td className="py-2 pr-4">{(lead.technologies ?? []).slice(0, 4).join(", ")}</td>
                  <td className="py-2 pr-4">{lead.top_confidence ?? "-"}</td>
                  <td className="py-2 pr-4">
                    {[lead.country, lead.language].filter(Boolean).join(" / ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Save lead list</h2>
        <form action={saveLeadList} className="flex flex-wrap gap-2">
          <input
            name="name"
            placeholder="My target list"
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
          />
          <input type="hidden" name="hasTech" value={hasTech ?? ""} />
          <input type="hidden" name="techCategory" value={techCategory ?? ""} />
          <input type="hidden" name="minConfidence" value={minConfidence ?? ""} />
          <input type="hidden" name="country" value={country ?? ""} />
          <input type="hidden" name="language" value={language ?? ""} />
          <button className="rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Save
          </button>
        </form>
      </section>
    </main>
  );
}
