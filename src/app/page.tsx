export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Technographic Lead List Engine</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        Milestone 1 is live: database schema, API-key auth scaffold, and domain CRUD endpoints are in place.
      </p>
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Available endpoints</h2>
        <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
          <li>
            <code>POST /api/domains</code> and <code>GET /api/domains</code>
          </li>
          <li>
            <code>POST /api/keys</code>, <code>GET /api/keys</code>, and{" "}
            <code>DELETE /api/keys/:id</code>
          </li>
        </ul>
      </section>
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Next milestone</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          Build crawl jobs, extraction workers, and artifact persistence for homepage + key paths.
        </p>
      </section>
    </main>
  );
}
