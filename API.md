# API (Milestone 1)

## Auth Headers

- Admin routes: `x-admin-token: <ADMIN_TOKEN>`
- Domain routes: `x-api-key: <issued raw api key>`

If `SKIP_API_KEY_AUTH=true`, auth checks are bypassed for local development.

## POST /api/keys

Create an API key.

Request body:

```json
{
  "ownerId": "00000000-0000-0000-0000-000000000001",
  "name": "primary key",
  "rateLimitPerMin": 120
}
```

Response includes `raw_key` once:

```json
{
  "apiKey": {
    "id": "...",
    "owner_id": "...",
    "name": "primary key",
    "rate_limit_per_min": 120,
    "active": true,
    "created_at": "...",
    "last_used_at": null,
    "raw_key": "tlle_..."
  }
}
```

## GET /api/keys?ownerId=<uuid>

List all keys for an owner (hashed values are never returned).

## DELETE /api/keys/:id

Soft-revoke an API key by setting `active=false`.

## POST /api/domains

Create or upsert a domain.

Request body:

```json
{
  "domain": "https://www.example.com/pricing",
  "status": "active"
}
```

Notes:

- Domain is normalized to hostname (`example.com`)
- Existing domain updates status and `updated_at`

## GET /api/domains

Query parameters:

- `status=active|paused|archived` (optional)
- `search=<substring>` (optional)
- `limit=<1..200>` (default `50`)
- `offset=<0+>` (default `0`)

## POST /api/crawl/:domainId

Create a crawl job and execute it immediately.

Response:

```json
{
  "crawlJob": {
    "id": "...",
    "status": "succeeded",
    "domainId": "...",
    "pagesAttempted": 4,
    "pagesStored": 3,
    "baseUrl": "https://example.com"
  }
}
```

## GET /api/crawl-jobs/:id

Fetch crawl job status and timestamps.

## GET /api/domains/:id/history

List recent crawl jobs for a domain.

## POST /api/domains/import

Bulk import via CSV text payload.

```json
{
  "csv": "example.com\nshop.com",
  "status": "active"
}
```

## GET /api/domains/:id/detections

Returns current + historical detections with confidence and evidence.

## GET /api/domains/:id/enrichment

Returns latest enrichment payload for a domain.

## GET /api/search/leads

Filter query:

- `hasTech`
- `techCategory`
- `minConfidence`
- `lastScannedAfter`
- `country`
- `language`
- `limit`
- `offset`

## Lead Lists

- `POST /api/lead-lists`
- `GET /api/lead-lists`
- `GET /api/lead-lists/:id`
- `POST /api/lead-lists/:id/refresh`
- `GET /api/lead-lists/:id/export.csv`

## Fingerprints Admin

- `GET /api/fingerprints`
- `POST /api/fingerprints`
- `PATCH /api/fingerprints/:id`

## Ops/Admin

- `GET /api/usage`
- `GET /api/admin/failed-jobs`
- `GET /api/admin/metrics`
- `POST /api/cron/recrawl?batch=10&staleHours=168`
- `GET /api/health`
