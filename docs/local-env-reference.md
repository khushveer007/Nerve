# Nerve Local Environment Reference

This document explains the variables used by local development, especially the `npm run dev:local` flow that reads [.env.local](/home/opsa/Work/Nerve/.env.local).

Use this together with:

- [.env.local.example](/home/opsa/Work/Nerve/.env.local.example)
- [server/config.ts](/home/opsa/Work/Nerve/server/config.ts)
- [scripts/dev-local.sh](/home/opsa/Work/Nerve/scripts/dev-local.sh)

## How To Read This

- `Required` means the local stack will not work correctly without it.
- `Optional` means the app can still start, but some behavior degrades or is disabled.
- Secret values should live only in `.env.local`, never in frontend code.
- Only variables prefixed with `VITE_` are exposed to the browser. Do not put API secrets in `VITE_*` variables.

## App And Frontend Routing

| Variable | Required | Typical local value | What it does | Why it matters |
| --- | --- | --- | --- | --- |
| `APP_BASE_URL` | Required | `http://127.0.0.1:8080` | Base URL used by the server for app-aware links and redirects. | Keeps server-generated paths aligned with your local frontend host. |
| `API_PORT` | Required | `3001` | Port the Express API listens on. | The local script starts the API here and the frontend expects it. |
| `VITE_API_BASE_URL` | Required | `/api` | Frontend base path for API calls. | Keeps browser requests routed to the local API through Vite. |
| `VITE_ASSISTANT_ENABLED` | Optional | `true` | Frontend flag controlling whether assistant UI is shown. | Lets you hide assistant UI if you are debugging other parts of the app. |
| `COOKIE_SECURE` | Required | `false` | Controls whether session cookies require HTTPS. | Must stay `false` for plain local HTTP or login cookies will not work. |

## Core Server Startup

| Variable | Required | Typical local value | What it does | Why it matters |
| --- | --- | --- | --- | --- |
| `SESSION_SECRET` | Required | `replace-with-a-local-session-secret` | Secret used to sign Express session cookies. | The server refuses to run without it because sessions depend on it. |
| `SUPER_ADMIN_EMAIL` | Optional | `super@parul.ac.in` | Bootstrap login email for the local super admin. | Useful if you want a different local login identity. |
| `SUPER_ADMIN_PASSWORD` | Required | `replace-with-local-dev-password` | Bootstrap password for the local super admin account. | Required at startup, and it must not use the legacy default password. |

## PostgreSQL And Local Docker Database

| Variable | Required | Typical local value | What it does | Why it matters |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required | `postgres://nerve_app:...@127.0.0.1:5432/nerve` | Connection string used by the API and worker. | The server cannot boot without a reachable database. |
| `POSTGRES_DB` | Required for `dev:local` | `nerve` | Database name given to the local Docker Postgres container. | Keeps the container database name aligned with `DATABASE_URL`. |
| `POSTGRES_USER` | Required for `dev:local` | `nerve_app` | Database user created in the local Docker Postgres container. | The DB container healthcheck and app login both depend on it. |
| `POSTGRES_PASSWORD` | Required for `dev:local` | `replace-with-db-password` | Password for the local Docker Postgres user. | Must match the password embedded in `DATABASE_URL`. |
| `POSTGRES_DATA_DIR` | Required for `dev:local` | `./.local/postgres-data` | Host path for persisted local Postgres data. | Lets your local DB survive restarts and debugging sessions. |

## Assistant Feature Toggle

| Variable | Required | Typical local value | What it does | Why it matters |
| --- | --- | --- | --- | --- |
| `ASSISTANT_RAG_ENABLED` | Optional | `true` | Enables the server-side assistant RAG stack. | If `false`, assistant routes stay disabled and indexing/querying will not run. |
| `ASSISTANT_QUERY_RESULT_LIMIT` | Optional | `20` | Caps result count returned by assistant queries. | Helps keep retrieval deterministic and response payloads small enough for local debugging. |

## Embedding Provider

These settings control ingestion-time and query-time embedding requests.

| Variable | Required | Typical local value | What it does | Why it matters |
| --- | --- | --- | --- | --- |
| `ASSISTANT_EMBEDDING_URL` | Optional | `https://.../embeddings` | HTTP endpoint for the embedding provider. | If empty, retrieval falls back to lexical-only search and semantic matching is disabled. |
| `ASSISTANT_EMBEDDING_API_KEY` | Optional | provider secret key | Secret sent with embedding requests. | Required by most providers when `ASSISTANT_EMBEDDING_URL` is set. |
| `ASSISTANT_EMBEDDING_API_HEADER` | Optional | `Authorization` | Header name used for the embedding key. | Lets you support nonstandard providers that do not use `Authorization`. |
| `ASSISTANT_EMBEDDING_AUTH_SCHEME` | Optional | `Bearer` | Prefix applied before the embedding API key. | Needed for OpenAI-compatible `Authorization: Bearer ...` requests. |
| `ASSISTANT_EMBEDDING_MODEL` | Optional | `text-embedding-3-small` | Provider model identifier for embeddings. | Must match a model that returns vectors compatible with your provider and schema. |
| `ASSISTANT_EMBEDDING_DIMENSIONS` | Required when embeddings are used | `1536` | Expected embedding vector size. | Must stay `1536` because the current `knowledge_chunks.embedding` schema is fixed to that dimension. The local dev script now fails fast if this changes. |
| `ASSISTANT_EMBEDDING_TIMEOUT_MS` | Optional | `3000` | Timeout for embedding HTTP calls. | Prevents local queries from hanging too long before gracefully degrading to lexical retrieval. |
| `ASSISTANT_EMBEDDING_MAX_QUERY_DISTANCE` | Optional | `0.35` | Cosine-distance cutoff used for semantic query candidates. | Keeps weak nearest-neighbor matches from polluting search results. |

### When embedding settings are actually required

- Required for semantic retrieval.
- Not required for lexical search.
- If you set `ASSISTANT_EMBEDDING_API_KEY`, you should also set `ASSISTANT_EMBEDDING_URL`. The local script validates this.

## Answer Generation Provider

These settings control grounded Ask-mode answer generation.

| Variable | Required | Typical local value | What it does | Why it matters |
| --- | --- | --- | --- | --- |
| `ASSISTANT_ANSWER_URL` | Optional | `https://.../chat/completions` | HTTP endpoint for the answer-generation provider. | If empty, Ask mode can still run evidence checks but will not generate grounded answers. |
| `ASSISTANT_ANSWER_API_KEY` | Optional | provider secret key | Secret sent with answer-generation requests. | Required by most providers when `ASSISTANT_ANSWER_URL` is set. |
| `ASSISTANT_ANSWER_API_HEADER` | Optional | `Authorization` | Header name used for the answer API key. | Supports providers with custom auth headers. |
| `ASSISTANT_ANSWER_AUTH_SCHEME` | Optional | `Bearer` | Prefix applied before the answer API key. | Needed for OpenAI-compatible auth flows. |
| `ASSISTANT_ANSWER_MODEL` | Optional | `gpt-4.1-mini` | Provider model identifier for grounded answer generation. | Lets you choose the real LLM used for Ask-mode responses. |
| `ASSISTANT_ANSWER_TIMEOUT_MS` | Optional | `5000` | Timeout for answer-generation HTTP calls. | Prevents local Ask-mode requests from hanging too long before falling back safely. |

### When answer settings are actually required

- Required for real grounded generated answers.
- Not required for search mode.
- If you set `ASSISTANT_ANSWER_API_KEY`, you should also set `ASSISTANT_ANSWER_URL`. The local script validates this.

## Worker And Reindexing Controls

| Variable | Required | Typical local value | What it does | Why it matters |
| --- | --- | --- | --- | --- |
| `ASSISTANT_WORKER_POLL_MS` | Optional | `1000` | Delay between worker polling cycles. | Controls how quickly queued indexing jobs are picked up locally. |
| `ASSISTANT_JOB_MAX_ATTEMPTS` | Optional | `3` | Maximum retry attempts for failed indexing jobs. | Helps you debug flaky provider or ingestion failures without infinite retry loops. |
| `ASSISTANT_JOB_RETRY_BASE_MS` | Optional | `15000` | Base retry delay for failed jobs. | Controls how aggressively the worker retries failures. |
| `ASSISTANT_JOB_STALE_LOCK_MS` | Optional | `60000` | Threshold for reclaiming stale running jobs. | Protects the queue when a worker crashes or gets stuck during local testing. |

## Common Local Config Profiles

### 1. Lexical-only local debugging

Use this when you only want the app and database working and do not need real providers yet.

```env
ASSISTANT_RAG_ENABLED=true
ASSISTANT_EMBEDDING_URL=
ASSISTANT_ANSWER_URL=
```

Behavior:

- search works through lexical/hybrid fallback
- semantic embedding retrieval is disabled
- Ask mode can abstain, but grounded generated answers are disabled

### 2. Real embedding provider only

Use this when you want semantic search quality but not full answer generation yet.

```env
ASSISTANT_EMBEDDING_URL=https://your-provider.example/v1/embeddings
ASSISTANT_EMBEDDING_API_KEY=your_embedding_key
ASSISTANT_EMBEDDING_MODEL=text-embedding-3-small
ASSISTANT_EMBEDDING_DIMENSIONS=1536

ASSISTANT_ANSWER_URL=
```

Behavior:

- indexing and query-time embeddings are enabled
- semantic retrieval is enabled
- Ask mode still does not generate final grounded answers

### 3. Full real-provider local testing

Use this when you want to test the closest local equivalent of production assistant behavior.

```env
ASSISTANT_EMBEDDING_URL=https://your-provider.example/v1/embeddings
ASSISTANT_EMBEDDING_API_KEY=your_embedding_key
ASSISTANT_EMBEDDING_MODEL=text-embedding-3-small
ASSISTANT_EMBEDDING_DIMENSIONS=1536

ASSISTANT_ANSWER_URL=https://your-provider.example/v1/chat/completions
ASSISTANT_ANSWER_API_KEY=your_answer_key
ASSISTANT_ANSWER_MODEL=gpt-4.1-mini
```

Behavior:

- semantic retrieval is enabled
- Ask mode can generate grounded answers
- the local dev script prints both providers as enabled at startup

## Startup Checklist

Before running `npm run dev:local`, make sure:

1. `.env.local` exists.
2. `DATABASE_URL` matches `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`.
3. `COOKIE_SECURE=false` for local HTTP.
4. `ASSISTANT_EMBEDDING_DIMENSIONS=1536`.
5. If an embedding key is set, `ASSISTANT_EMBEDDING_URL` is also set.
6. If an answer key is set, `ASSISTANT_ANSWER_URL` is also set.

Then start local dev with:

```bash
npm ci
npm run dev:local
```
