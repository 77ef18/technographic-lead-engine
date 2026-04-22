# Architecture (MVP)

## Stack

- Frontend/API: Next.js 16 route handlers
- Database: PostgreSQL
- Migrations: SQL files + lightweight Node runner
- Auth: API keys (hashed at rest) + admin token for key management

## Milestone 1 Components

- `db/migrations/0001_milestone1.sql`
  - Creates core entities from spec (`domains`, `crawl_jobs`, `crawl_pages`, `technologies`, `fingerprints`, `detections`, `enrichments`, `lead_lists`, `lead_list_entries`, `api_keys`)
  - Adds required indexes and uniqueness constraints
- `scripts/run-migrations.mjs`
  - Applies SQL migrations once and tracks completion in `_migrations`
- `src/lib/db.ts`
  - Shared Postgres pool and query helper
- `src/lib/auth.ts`
  - API key hashing, secure key generation, and in-memory per-minute rate limiting
- `src/app/api/domains/route.ts`
  - Domain ingestion/list baseline with normalization and idempotent upsert
- `src/app/api/keys/*`
  - API key create/list/revoke endpoints for operators

## Security Notes

- API keys are never stored in plaintext.
- Plaintext key is returned only on creation.
- Admin-only key management is protected by `x-admin-token` + `ADMIN_TOKEN`.
- Domain APIs require `x-api-key` unless local bypass is enabled for development.

## Next Milestone Targets

- Queue-backed crawl jobs (`queued -> running -> succeeded/failed`)
- Multi-page extraction (`/`, `/about`, `/pricing`, `/blog`)
- Raw artifact persistence in `crawl_pages`

## Milestone 2 (Implemented)

- `POST /api/crawl/:domainId` creates a crawl job and runs worker logic.
- Worker fetches homepage plus key paths with timeout + retry.
- Response artifacts are persisted in `crawl_pages` (headers/cookies/scripts/meta/hash).
- Homepage metadata snapshot is persisted to `enrichments`.
- `GET /api/crawl-jobs/:id` and `GET /api/domains/:id/history` provide scan visibility.

## Milestone 3 (Implemented)

- Fingerprint detection engine with weighted confidence scoring.
- Multi-signal boost, requires/implies/excludes dependency logic.
- Automatic detection persistence (`is_current` tracking + evidence JSON).
- Seed pipeline for high-value technologies/fingerprints.

## Milestone 4 (Implemented)

- Lead search API with filtering by tech/category/confidence/date/geo/language.
- Saved lead lists + refresh workflow + CSV export endpoint.
- Minimal UI pages for domains, domain details, lead builder, and lead list details.

## Milestone 5 (Implemented)

- Structured logging with correlation fields (`domain_id`, `crawl_job_id`).
- Retry/dead-letter behavior for repeated crawl failures.
- Metrics and failed-job admin endpoints for operations visibility.
- Terms and privacy pages, plus retention policy documentation.
