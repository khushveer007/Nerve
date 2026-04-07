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

For a variable-by-variable explanation of the local stack, see [local-env-reference.md](./local-env-reference.md).

Useful defaults or optional values:

- `API_PORT` defaults to `3001`
- `APP_BASE_URL` defaults to `http://127.0.0.1`
- `COOKIE_SECURE` defaults to `false`
- `SUPER_ADMIN_EMAIL` defaults to `super@parul.ac.in`
- `ASSISTANT_RAG_ENABLED` defaults to `true`
- `ASSISTANT_QUERY_RESULT_LIMIT` defaults to `20`
- `ASSISTANT_EMBEDDING_URL` is optional; if omitted, ingestion stores null embeddings and query-time retrieval degrades to metadata + FTS + trigram ranking
- `ASSISTANT_EMBEDDING_TIMEOUT_MS` defaults to `3000` so slow query-time embedding calls degrade back to lexical retrieval
- `ASSISTANT_EMBEDDING_MAX_QUERY_DISTANCE` defaults to `0.35` for cosine-distance filtering so nearest-neighbor results still need a minimum relevance bar
- `ASSISTANT_ANSWER_URL` is optional but required for grounded Ask-mode answer generation
- `ASSISTANT_ANSWER_MODEL` defaults to `gpt-4.1-mini`
- `ASSISTANT_ANSWER_TIMEOUT_MS` defaults to `5000`
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

### Option 3: Run `dev:local` for feature testing with real providers

The repo includes a local-debug path in [dev-local.sh](../scripts/dev-local.sh). This is the recommended way to test new assistant features with real embedding and answer-provider credentials while still keeping the app and worker easy to debug.

```bash
npm ci
cp .env.local.example .env.local
npm run dev:local
```

`npm run dev:local` will:

- start PostgreSQL in Docker and publish it on `127.0.0.1:5432`
- source `.env.local`
- validate the assistant provider configuration before boot
- print whether embeddings and grounded answer generation are enabled
- start the API, worker, and Vite frontend together

For real provider testing, fill these values in `.env.local`:

- `ASSISTANT_EMBEDDING_URL`
- `ASSISTANT_EMBEDDING_API_KEY`
- `ASSISTANT_EMBEDDING_MODEL`
- `ASSISTANT_ANSWER_URL`
- `ASSISTANT_ANSWER_API_KEY`
- `ASSISTANT_ANSWER_MODEL`

Keep `ASSISTANT_EMBEDDING_DIMENSIONS=1536`. The current `knowledge_chunks.embedding` schema depends on that dimension, and the local dev script now fails fast if it is changed.

If `ASSISTANT_EMBEDDING_URL` is left empty, retrieval stays lexical-only. If `ASSISTANT_ANSWER_URL` is left empty, Ask mode can still run but will not produce grounded generated answers.

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
6. Keep `auto` intent routing deterministic inside `server/rag/*`; Phase 1 should prefer explainable search behavior over speculative answer text
7. Keep Phase 1 filters server-enforced inside `searchEntryKnowledge(...)`; the assistant shell now sends `department`, inclusive `date_range`, and `sort`, and transcript turns rely on `applied_filters` plus `total_results` coming back from the API
8. Keep Ask-mode sufficiency gating deterministic and server-enforced before any answer-model call; weak or conflicting evidence must return an explainable abstention payload instead of unsupported prose
9. Keep grounded answer generation behind the configured answer endpoint and constrain prompts to selected ACL-safe evidence only
10. Keep citation inspection on the same trust boundary as result-card preview/open actions; grounded citations may include assistant-safe `source` and action metadata, but `/api/assistant/query`, `/api/assistant/source-preview`, and `/api/assistant/source-open` remain the only Phase 1 evidence endpoints
11. Keep operational telemetry fail-open and server-owned; `server/observability/*` may persist request and job signals, but telemetry writes must never replace the normal assistant result, no-answer, or `403` response

## Assistant Telemetry And Failure Taxonomy

Story 1.7 adds a lean Phase 1 observability layer for launch operations:

- `assistant_request_telemetry` stores request-scoped signals for `/api/assistant/query`, `/api/assistant/source-preview`, and `/api/assistant/source-open`
- `assistant_job_telemetry` stores enqueue, retry, dead-letter, stale-lock recovery, and success events for the existing `knowledge_jobs` lifecycle
- `server/observability/metrics.ts` exposes typed write helpers plus read-side helpers such as `listRecentAssistantRequestTelemetry()` and `getAssistantOperationalSnapshot()`

The top-level failure taxonomy is intentionally small:

- `retrieval_failure`: corpus/search/evidence-loading failures that stop the request or job from completing normally
- `permission_failure`: denied preview/open trust-boundary requests
- `provider_failure`: embedding or answer-provider degradation, including graceful fallback paths
- `none`: the request completed without an operational failure classification

`no_answer` is an outcome, not a failure class. If evidence is insufficient or conflicting, telemetry should record `outcome = 'no_answer'` with `failure_classification = 'none'`.

## Operational Inspection Workflow

For a quick SQL-first inspection in local or production-like environments:

```sql
SELECT
  request_id,
  action,
  outcome,
  failure_classification,
  failure_subtype,
  result_count,
  citation_count,
  stage_timings,
  provider_metadata,
  created_at
FROM assistant_request_telemetry
ORDER BY created_at DESC
LIMIT 25;
```

```sql
SELECT
  event_type,
  status,
  failure_classification,
  failure_subtype,
  latency_ms,
  retry_delay_ms,
  created_at
FROM assistant_job_telemetry
ORDER BY created_at DESC
LIMIT 25;
```

For a code-level read model without building the later analytics UI, use `getAssistantOperationalSnapshot()` from [`server/observability/metrics.ts`](../server/observability/metrics.ts). It rolls up recent provider degradations, retrieval/permission failures, queue depth, dead-letter counts, and freshness-adjacent job/version age signals from the existing knowledge tables.

## Phase 1 Launch Evaluation

Story 1.8 adds a deterministic launch-quality gate on top of the existing entry-backed assistant suite. It is still server-first: no public dashboard, no client analytics surface, and no duplicate evaluation datastore.

Run the launch guardrails with:

```bash
TEST_DATABASE_URL=postgres://nerve_app:replace-with-db-password@127.0.0.1:5432/postgres \
  npm run test:server -- server/test/rag/rag.integration.test.ts -t "launch-quality gate:"
```

Use the same host, port, user, and password as the reachable PostgreSQL instance behind your local setup. With `npm run dev:local`, that host is `127.0.0.1:5432`, and the test runtime creates an isolated ephemeral database for each run.

The launch suite covers:

- exact-match entry search staying discoverable in the top results
- semantic retrieval when wording diverges from the stored entry text
- grounded-answer turns that must emit citations on substantive answers
- correct `no_answer` abstention when evidence is weak or conflicting
- ACL-sensitive query, preview, and open flows without blocked-source metadata leakage

To inspect the telemetry-backed launch summary directly from the server read model, run:

```bash
npx tsx --eval 'import { getAssistantLaunchSummary } from "./server/observability/metrics.ts";
const summary = await getAssistantLaunchSummary({ hours: 24 });
console.log(JSON.stringify(summary, null, 2));'
```

`getAssistantLaunchSummary()` reuses `assistant_request_telemetry` and reports:

- citation coverage for grounded answers
- no-answer rate across ask-path requests
- search-versus-ask request mix
- p95 latency for search and ask paths compared with the Phase 1 targets
- denied source-preview/source-open counts and other request outcomes

Interpret the latency targets as:

- search path p95 should stay at or below `2500` ms
- grounded/ask path p95 should stay at or below `8000` ms

Treat these outcomes as launch blockers until remediated and tracked with follow-up work:

- blocked-source leakage through query results, citations, preview payloads, or open payloads
- unsupported narrative answers where the assistant should have abstained
- substantive grounded answers that ship without citation coverage
- search path p95 latency above `2500` ms in the launch telemetry summary
- grounded/ask path p95 latency above `8000` ms in the launch telemetry summary

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
- Assistant embeddings are optional in Phase 1; if no embedding endpoint is configured, search still works through metadata-aware exact matching, trigram, and FTS.
- Routed `ask` turns now return grounded answers only when the server judges evidence sufficient; otherwise the API returns an abstention or fallback payload without calling the answer model.
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
