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
