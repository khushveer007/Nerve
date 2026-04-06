# Nerve - API Server Development Guide

**Date:** 2026-04-05
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
- `ASSISTANT_RAG_ENABLED` defaults to `true`
- `ASSISTANT_QUERY_RESULT_LIMIT` defaults to `5`
- `ASSISTANT_EMBEDDING_URL` is optional; if omitted, the Phase 1 query path stays search-first and stores null embeddings
- `ASSISTANT_WORKER_POLL_MS`, `ASSISTANT_JOB_MAX_ATTEMPTS`, `ASSISTANT_JOB_RETRY_BASE_MS`, and `ASSISTANT_JOB_STALE_LOCK_MS` control the PostgreSQL job worker

## Local Setup

### Option 1: Run against an existing local PostgreSQL instance

```bash
npm ci
cp .env.example .env
npm run dev:server
npm run dev:worker
```

If you use this path, ensure `DATABASE_URL` points to a reachable local database. The sample `.env.example` uses `127.0.0.1:5432`.

### Option 2: Run with Docker Compose

```bash
npm ci
cp .env.example .env
docker compose up -d db api worker
```

If the API itself runs in Docker, its `DATABASE_URL` should target the Compose service host (`db`) rather than `127.0.0.1`.

## Build And Runtime Commands

```bash
npm run dev:server
npm run dev:worker
npm run build:server
npm run start:server
npm run start:worker
docker compose up -d db api worker
docker compose ps
```

## Startup Behavior To Know

When the server boots, it:

1. Loads and validates env config in `server/config.ts`
2. Configures JSON parsing and PostgreSQL-backed sessions
3. Creates the core tables if missing
4. Seeds built-in teams, users, and entries if the tables are empty
5. Replaces the legacy seeded super-admin credentials with configured values
6. Runs versioned RAG migrations from `server/migrations/`
7. Queues entry backfill jobs for the worker
8. Starts listening on `API_PORT`

This means local startup is stateful. Changes to the seed logic or bootstrap rules can affect every fresh environment.

## Important Files

- `server/index.ts` - middleware, auth gate, routes, startup
- `server/db.ts` - SQL schema creation, row mapping, and CRUD operations
- `server/migrations/*.sql` - versioned RAG schema and index definitions
- `server/rag/*` - assistant routes, ingestion, search, and job helpers
- `server/workers/rag-worker.ts` - PostgreSQL-backed RAG worker entrypoint
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

### Change the assistant RAG layer

1. Add or edit SQL migrations in `server/migrations/`
2. Keep retrieval/indexing code in `server/rag/*`, not inline in `server/index.ts`
3. Update the worker path in `server/workers/rag-worker.ts` when queue semantics change
4. Extend `server/test/rag/*` and the assistant client tests together so backend and shell behavior stay aligned
5. Preserve the session-driven actor handoff from route -> zod schema -> service -> ACL/db helpers so assistant retrieval never falls back to anonymous access

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

- `server/db.ts` still owns the business-table bootstrap path, so keep new retrieval work in `server/rag/*` rather than growing it further.
- Assistant embeddings are optional in Story 1.2; if no embedding endpoint is configured, search still works through metadata, trigram, and FTS.
- The retained Supabase schema diverges from the active API role model.

## Recommended Checks Before Merging Backend Work

```bash
npm run lint
npm test
npm run build:server
npm run build
```

For deployment-sensitive changes, also validate:

```bash
docker compose up -d db api worker
curl -sS http://127.0.0.1:3001/api/health
```

---

_Generated using BMAD Method `document-project` workflow_
