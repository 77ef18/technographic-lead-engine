# Google Apps Script Integrations

This folder contains drop-in scripts for low-cost automation.

## Scripts

- `daily_digest.gs`
  - Sends a daily email with recently scanned leads as CSV attachment.
- `csv_domain_sync.gs`
  - Reads domains from a Google Sheet and imports into `/api/domains/import`.

## Setup

1. Open [script.google.com](https://script.google.com/).
2. Create project, paste script file contents.
3. Update constants:
   - `APP_BASE_URL`
   - `API_KEY`
   - `ALERT_EMAIL` (digest script)
   - `SHEET_NAME` (sync script)
4. Add time-based triggers.

## Required API Access

Both scripts call your deployed app with `x-api-key`.
Make sure the key has a suitable per-minute rate limit.
