# Technographic Lead List Engine (MVP)

Milestone 1 foundation for a Wappalyzer-style lead engine:

- Next.js 16 app router service
- Postgres schema + SQL migration runner
- API key model with hashed keys and simple rate limiting
- Domain CRUD endpoints (normalized and idempotent)

## Quick Start

1. Create environment config:

```bash
cp .env.example .env.local
```

2. Set `DATABASE_URL` and (for production) `ADMIN_TOKEN`.

3. Run migrations:

```bash
npm run db:migrate
```

4. Start the app:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - run local server
- `npm run build` - production build
- `npm run lint` - eslint
- `npm run db:migrate` - execute SQL migrations in `db/migrations`

## Milestone 1 API

- `POST /api/keys` (admin)
- `GET /api/keys?ownerId=<uuid>` (admin)
- `DELETE /api/keys/:id` (admin)
- `POST /api/domains` (requires `x-api-key`)
- `GET /api/domains` (requires `x-api-key`)

See `API.md` for request/response examples.

## Docs

- `ARCHITECTURE.md` - system layout and milestone boundaries
- `API.md` - endpoint contract currently implemented
