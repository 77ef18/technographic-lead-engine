# Runbook

## Setup

1. Configure `.env.local` with `DATABASE_URL`.
2. Run `npm run db:migrate`.
3. Seed fingerprints with `npm run db:seed:fingerprints`.
4. Start app via `npm run dev`.

## Scheduled Recrawls

Use cron (GitHub Actions / platform cron) to call:

- `POST /api/cron/recrawl?batch=10&staleHours=168`
- Header: `x-admin-token: <ADMIN_TOKEN>`

For GitHub Actions:

- configure `APP_BASE_URL`, `ADMIN_TOKEN`, `RECRAWL_BATCH`, `RECRAWL_STALE_HOURS`
- use `.github/workflows/recrawl.yml`

## Failure Handling

- Crawl jobs retry with incremented attempts.
- Repeated failures are marked with `[dead-letter]` in `error_message`.
- Inspect via `GET /api/admin/failed-jobs`.

## Metrics

Use `GET /api/admin/metrics` for:

- job status counts
- average scan time
- average detections per domain
- retry rate

## Operational Notes

- APIs return `503` when DB is unavailable.
- Keep `SKIP_API_KEY_AUTH=false` outside local development.
- Health endpoint: `GET /api/health`.
