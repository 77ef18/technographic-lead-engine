export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        We store domain-level crawl artifacts, technology detections, and lead list metadata to operate this
        service.
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        We do not collect private account data from target websites and rely on publicly accessible pages and
        metadata.
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        Data retention default: crawl artifacts and detections are retained for 12 months unless earlier deletion
        is requested.
      </p>
    </main>
  );
}
