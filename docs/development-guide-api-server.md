# Nerve - API Server Development Guide

**Date:** 2026-04-02
**Part:** `api-server`

## Scope

This guide covers local development for the Express/PostgreSQL backend in `server/`.

## Prerequisites

- Node.js 22.x
- npm
- PostgreSQL 16+ or Docker / Docker Compose
- Required env vars from `.env.example`

## Required Environment Variables

These must be present or the server will fail at startup:

- `DATABASE_URL`
- `SESSION_SECRET`
- `SUPER_ADMIN_PASSWORD`

Useful defaults or optional values:

- `API_PORT` defaults to `3001`
- `APP_BASE_URL` defaults to `http://127.0.0.1`
- `COOKIE_SECURE` defaults to `false`
- `SUPER_ADMIN_EMAIL` defaults to `super@parul.ac.in`

## Local Setup

### Option 1: Run against an existing local PostgreSQL instance

```bash
npm ci
cp .env.example .env
npm run dev:server
```

If you use this path, ensure `DATABASE_URL` points to a reachable local database. The sample `.env.example` uses `127.0.0.1:5432`.

### Option 2: Run with Docker Compose

```bash
npm ci
cp .env.example .env
docker compose up -d db api
```

If the API itself runs in Docker, its `DATABASE_URL` should target the Compose service host (`db`) rather than `127.0.0.1`.

## Build And Runtime Commands

```bash
npm run dev:server
npm run build:server
npm run start:server
docker compose up -d db api
docker compose ps
```

## Startup Behavior To Know

When the server boots, it:

1. Loads and validates env config in `server/config.ts`
2. Configures JSON parsing and PostgreSQL-backed sessions
3. Creates the core tables if missing
4. Seeds built-in teams, users, and entries if the tables are empty
5. Replaces the legacy seeded super-admin credentials with configured values
6. Starts listening on `API_PORT`

This means local startup is stateful. Changes to the seed logic or bootstrap rules can affect every fresh environment.

## Important Files

- `server/index.ts` - middleware, auth gate, routes, startup
- `server/db.ts` - SQL schema creation, row mapping, and CRUD operations
- `server/config.ts` - env loading and guardrails
- `server/password.ts` - hashing and verification
- `server/seed.ts` - built-in teams, users, entries, and legacy bootstrap values

## Common Backend Change Workflows

### Add a new endpoint

1. Add request validation in `server/index.ts`
2. Implement SQL access in `server/db.ts`
3. Update `src/lib/api.ts` and, if needed, `useAppData.tsx`
4. Document the endpoint in `docs/api-contracts-api-server.md`

### Change a data model

1. Update the table DDL in `bootstrapDatabase()`
2. Update row interfaces and mapping helpers
3. Update request schemas and client-side types
4. Revisit seed data if the shape changed
5. Update `docs/data-models-api-server.md`

### Change auth or role behavior

1. Update `RoleGuard` on the client if needed
2. Update API helpers such as `isBrandingManager()` and `canCreateManagedUser()`
3. Verify session restore still works through `/api/auth/me`

## Operational Scripts

The repo includes production-focused scripts in `deploy/scripts/`:

- `deploy.sh` - fetch, build, test, container restart, static release publish
- `backup-postgres.sh` - dump and gzip database backups
- `restore-postgres.sh` - restore a dump into a target database
- `test-restore.sh` - restore into a temporary database and validate row counts

These scripts assume a VPS filesystem layout under `/srv/nerve`.

## Known Constraints

- The backend has no dedicated automated test suite yet.
- `server/db.ts` is the central data module and may become hard to evolve without careful refactoring.
- Startup schema creation works for small deployments but can blur the line between app boot and migrations.
- The retained Supabase schema diverges from the active API role model.

## Recommended Checks Before Merging Backend Work

```bash
npm run lint
npm test
npm run build:server
```

For deployment-sensitive changes, also validate:

```bash
docker compose up -d db api
curl -sS http://127.0.0.1:3001/api/health
```

---

_Generated using BMAD Method `document-project` workflow_
