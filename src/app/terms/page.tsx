export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Terms of Use</h1>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        This product collects and processes publicly available website signals for prospecting and analytics.
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        You agree to use exported data responsibly, comply with applicable laws, and avoid misuse including
        unauthorized scraping of private or authenticated resources.
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        We may rate-limit requests and suspend access in cases of abuse, security risk, or policy violations.
      </p>
    </main>
  );
}
