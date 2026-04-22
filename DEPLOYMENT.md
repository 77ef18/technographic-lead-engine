# Deployment Guide (Free-Tier Focus)

This setup keeps costs close to zero for low-volume MVP usage.

## Recommended Stack

- App/API: Vercel Hobby
- Database: Neon Free
- Scheduling: GitHub Actions cron
- Email alerts / CSV sync: Google Apps Script

## 1) Deploy App to Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repo.
3. Framework preset: Next.js.
4. Build command: `npm run build` (default).
5. Output: Next.js default.

## 2) Configure Environment Variables (Vercel)

Add these in Vercel project settings:

- `DATABASE_URL` (Neon connection string)
- `ADMIN_TOKEN` (strong random value)
- `SKIP_API_KEY_AUTH=false`
- `DEV_OWNER_ID=00000000-0000-0000-0000-000000000000`
- `DEV_RATE_LIMIT_PER_MIN=120`

## 3) Initialize Database

Run once locally (pointing at Neon):

```bash
npm run db:migrate
npm run db:seed:fingerprints
```

## 4) Create API Key for Runtime Integrations

Use admin token:

```bash
curl -X POST "https://<your-app>.vercel.app/api/keys" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: <ADMIN_TOKEN>" \
  -d '{"ownerId":"00000000-0000-0000-0000-000000000000","name":"automation","rateLimitPerMin":120}'
```

Store returned `raw_key` securely. It is shown once.

## 5) Set Up Scheduled Recrawls (GitHub Actions)

This repo includes `.github/workflows/recrawl.yml`.

Add these repository secrets:

- `APP_BASE_URL` = `https://<your-app>.vercel.app`
- `ADMIN_TOKEN` = same value as app env
- `RECRAWL_BATCH` = e.g. `20`
- `RECRAWL_STALE_HOURS` = e.g. `168`

The workflow runs daily and can be triggered manually.

## 6) Healthcheck

Use:

- `GET /api/health`

Expected response:

```json
{ "ok": true, "service": "technographic-lead-engine", "timestamp": "..." }
```

## 7) Google Apps Script Integrations

Templates are in:

- `integrations/google-apps-script/daily_digest.gs`
- `integrations/google-apps-script/csv_domain_sync.gs`

Use these to:

- send daily email digests of new/recently scanned leads
- push Google Sheet domain rows into `/api/domains/import`
