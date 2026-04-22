import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Technographic Lead List Engine</h1>
      <p className="text-zinc-600 dark:text-zinc-300">
        MVP foundation is live: domains, crawl/extract, fingerprint detection, and lead list workflows.
      </p>
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-600" href="/domains">
          Domains
        </Link>
        <Link className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-600" href="/lead-builder">
          Lead Builder
        </Link>
        <Link className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-600" href="/lead-lists">
          Lead Lists
        </Link>
        <Link className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-600" href="/terms">
          Terms
        </Link>
        <Link className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-600" href="/privacy">
          Privacy
        </Link>
      </nav>
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
          <li>
            <code>POST /api/crawl/:domainId</code>, <code>GET /api/crawl-jobs/:id</code>, and{" "}
            <code>GET /api/domains/:id/history</code>
          </li>
        </ul>
      </section>
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Next milestone</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          Harden retry/dead-letter behavior, add metrics views, and expand integration tests.
        </p>
      </section>
    </main>
  );
}
