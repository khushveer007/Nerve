# Story 1.2: Index Existing Entries as the Phase 1 Knowledge Corpus

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Nerve user,
I want the current Nerve entries to be searchable by the assistant,
so that the first production release answers from live institutional content.

**FRs implemented:** FR7, FR25

## Acceptance Criteria

1. Given the Phase 1 migrations are run, when the application and worker start, then the RAG schema objects needed for entry-backed retrieval exist, and the schema is created through versioned migrations rather than new inline bootstrap DDL.
2. Given existing Nerve entries are present, when the entry indexing flow runs, then each eligible entry is represented as a knowledge asset with versioned chunked content and citation locator metadata, and entry metadata needed for ranking and filtering is preserved.
3. Given an entry is created or updated, when the reindex flow is triggered, then the changed content becomes searchable within 5 minutes, and the previously indexed version is superseded safely.
4. Given Phase 1 is active, when assistant queries run, then the searchable corpus is limited to existing entry-backed knowledge, and no file, PDF, or image upload content is referenced yet.
5. Given indexed entry content is available, when an authenticated user submits a known-item or discovery query for that content, then the assistant can return at least one accessible entry-backed result from the indexed corpus, and the result is identifiable as Phase 1 entry content rather than a later mixed-media source type.

## Tasks / Subtasks

- [x] Establish the RAG migration baseline and startup path without expanding bootstrap DDL again (AC: 1)
  - [x] Create `server/migrations/001_rag_base.sql` for the new knowledge tables and any required status constraints/defaults.
  - [x] Create follow-on migration files such as `server/migrations/002_rag_indexes.sql` and `server/migrations/003_rag_jobs.sql` for `pg_trgm`, FTS, vector, and job-queue indexes instead of hiding them in `server/db.ts`.
  - [x] Add a small migration runner that executes before the API listens and before the worker starts.
  - [x] Keep `users`, `teams`, `entries`, `branding_rows`, and `session` as business tables in `server/db.ts`; the new migrations are only for the derived RAG layer.

- [x] Create the new `server/rag/*` module family and keep route/service boundaries clean (AC: 1, 4, 5)
  - [x] Add initial modules such as `server/rag/types.ts`, `server/rag/schemas.ts`, `server/rag/db.ts`, `server/rag/chunking.ts`, `server/rag/ingestion.ts`, `server/rag/jobs.ts`, `server/rag/routes.ts`, and `server/rag/service.ts`.
  - [x] Mount assistant routes from `server/index.ts` instead of embedding retrieval/indexing logic inline.
  - [x] Add `GET /api/assistant/health` so the Story 1.1 assistant availability check can reflect a real backend state.
  - [x] Add the first `POST /api/assistant/query` contract with named payload wrappers and machine-readable `grounded` / `enough_evidence` fields, while keeping the response entry-only in this story.

- [x] Project existing `entries` into the generic knowledge-asset model with versioned chunk storage (AC: 2, 3, 4)
  - [x] Create `knowledge_assets`, `knowledge_asset_versions`, `knowledge_chunks`, `knowledge_acl_principals`, and `knowledge_jobs` with the Phase 1 status enums defined in architecture.
  - [x] Represent each indexed entry as `source_kind = 'entry'`, linked back to the business row through `source_table = 'entries'` and `source_id = entries.id`.
  - [x] Preserve metadata needed for ranking/filtering, including at minimum `dept`, `type`, `tags`, `entry_date`, `academic_year`, `author_name`, `created_by`, `priority`, `student_count`, `external_link`, and `collaborating_org`.
  - [x] Store versioned normalized content plus chunk rows with `search_vector`, `embedding vector(1536)`, `metadata JSONB`, and `citation_locator JSONB`.
  - [x] Chunk entries by paragraph or section boundaries instead of blind fixed-width slicing; include title plus key metadata in the first chunk.
  - [x] Supersede older indexed versions safely so search uses the newest ready version without destroying traceability.

- [x] Add the entry indexing queue, worker, and reindex triggers needed for freshness (AC: 1, 2, 3)
  - [x] Create `server/workers/rag-worker.ts` and keep job execution out of `server/index.ts`.
  - [x] Use a PostgreSQL-backed queue with idempotent jobs, retry/backoff behavior, and `dead_letter` handling.
  - [x] Add a backfill path so already-seeded or already-existing entries become knowledge assets without manual row-by-row intervention.
  - [x] Enqueue reindex work from `POST /api/entries`.
  - [x] The current active API has no entry update route; add a minimal `PATCH /api/entries/:id` path plus shared reindex trigger so the acceptance criterion for updates is actually satisfiable in Phase 1.
  - [x] Add the worker dev/runtime entrypoints required to run this slice locally and in Compose, including `npm run dev:worker` and a `worker` service in `docker-compose.yml`.

- [x] Deliver the minimal entry-backed assistant query slice without jumping ahead to Stories 1.3 through 1.6 (AC: 4, 5)
  - [x] Wire the assistant feature to a real backend query path through feature-scoped hooks and API helpers, not through `useAppData().entries`.
  - [x] Return search-first entry-backed results only; do not introduce uploaded-file, PDF, or image result kinds yet.
  - [x] Keep the result payload identifiable as entry content, for example via `source_kind: 'entry'` and entry-specific metadata/snippet fields.
  - [x] Do not implement final permission-safe filtering logic, hybrid ranking/fusion, answer synthesis, or citation-inspection UX here beyond what is minimally required for corpus validation; those remain the responsibility of Stories 1.3 through 1.6.
  - [x] Do not reintroduce the old local keyword fallback or fake answers anywhere in the assistant shell.

- [x] Add coverage, configuration, and documentation updates for the new corpus foundation (AC: 1, 2, 3, 4, 5)
  - [x] Update `server/config.ts` and `.env.example` with assistant/provider/worker settings needed for this slice, keeping generation/extraction wiring optional where later stories own the first live use.
  - [x] Update `vitest.config.ts` or add a dedicated server-test configuration, because the current test include pattern only runs `src/**/*.{test,spec}.{ts,tsx}` and would miss `server/test/rag/*`.
  - [x] Add server tests for migration idempotence, entry backfill/reindex, version supersession, and basic assistant query over indexed entries.
  - [x] Add or extend assistant client tests so Story 1.1's shell proves real backend availability and entry-backed result rendering without fallback copy.
  - [x] Update docs and contracts that become stale, especially `docs/api-contracts-api-server.md`, `docs/data-models-api-server.md`, and any local developer instructions affected by new worker/migration commands.

### Review Findings

- [x] [Review][Patch] Keep reindex/backfill from dropping already-ready assets out of search [server/rag/db.ts:226]
- [x] [Review][Patch] Make RAG migrations safe when API and worker start in parallel [server/rag/db.ts:130]
- [x] [Review][Patch] Keep startup backfill resilient when one entry fails to queue [server/rag/jobs.ts:34]
- [x] [Review][Patch] Keep the worker loop alive across transient processing failures [server/rag/jobs.ts:97]
- [x] [Review][Patch] Honor `ASSISTANT_RAG_ENABLED` across startup and query execution [server/index.ts:412]
- [x] [Review][Patch] Avoid returning a failed create/update after the entry row already committed [server/index.ts:379]
- [x] [Review][Patch] Remove deleted entries from the entry-backed assistant corpus [server/index.ts:407]
- [x] [Review][Patch] Reject embedding dimensions other than the fixed `vector(1536)` schema width [server/config.ts:63]
- [x] [Review][Patch] Ignore stale assistant replies after starting a new conversation [src/features/assistant/components/AssistantPage.tsx:163]
- [x] [Review][Patch] Block submission until the initial assistant availability check settles [src/features/assistant/components/AssistantPage.tsx:128]
- [x] [Review][Patch] Surface healthy assistant health states instead of dropping them on the floor [src/features/assistant/components/AssistantPage.tsx:80]

## Dev Notes

### Story Intent and Scope Boundaries

- This story is the data and retrieval foundation for Phase 1, not the full assistant experience.
- The goal is to make the existing `entries` corpus real, versioned, and searchable from the assistant with a minimal end-to-end slice.
- This story must not pull in private uploads, PDFs, image OCR, source downloads, persisted threads, or final citation-inspection UX.
- This story must not reintroduce the removed local keyword fallback from Story 1.1.
- Keep Phase 1 corpus scope strictly limited to entry-backed knowledge, even if the generic asset model is designed for later mixed-media expansion.

### Epic and Cross-Story Context

- Epic 1 is the Phase 1 brownfield release over existing `entries` only.
- Story 1.1 already replaced the legacy `AIQuery` page with the assistant shell and removed fake/local answering.
- Story 1.3 will enforce permission-safe retrieval and source actions.
- Story 1.4 and Story 1.4a will add hybrid ranking, intent routing, filters, and result-list refinement.
- Story 1.5 will add grounded answer generation and server-enforced no-answer behavior.
- Story 1.6 will add citation inspection and evidence verification.
- Because of that sequencing, Story 1.2 should establish the reusable indexing, versioning, worker, and entry-query contract that later stories extend rather than replace.

### Current Code Intelligence

- `server/index.ts` is still a monolithic Express entrypoint that starts by calling `bootstrapDatabase()`, `bootstrapBrandingDatabase()`, and `bootstrapSettingsDatabase()`, then listens for traffic.
- `server/db.ts` still owns core table creation and CRUD for the active runtime, including `entries`, but there is no `server/migrations/` directory and no `server/rag/` module family yet.
- The current active API exposes entry list/create/delete only. There is no entry update endpoint today, which is a direct gap against the "created or updated" freshness requirement.
- `server/` currently has no worker directory, no queue implementation, and no background job runner.
- `server/config.ts` and `.env.example` currently know nothing about assistant providers, embeddings, or worker polling/retry settings.
- `src/features/assistant/api.ts` already expects `/api/assistant/health` and uses `VITE_ASSISTANT_ENABLED`, but the server does not yet expose that route.
- `src/App.tsx` already mounts a root `QueryClientProvider`, `AuthProvider`, and `AppDataProvider`, so assistant-specific data should continue to live in feature-scoped hooks rather than in bootstrap state.
- Story 1.1 introduced the new `src/features/assistant/*` module and reserved transcript, filter, and evidence surfaces. Those are the correct extension points for this story's thin backend integration.

### Technical Requirements

- Use versioned SQL migrations under `server/migrations/`; do not add another long-lived RAG DDL block inside `bootstrapDatabase()`.
- Treat `entries` as the authoritative editable business records. The `knowledge_*` tables are derived retrieval structures, not the new source of truth.
- Add the architecture-defined tables:
  - `knowledge_assets`
  - `knowledge_asset_versions`
  - `knowledge_chunks`
  - `knowledge_acl_principals`
  - `knowledge_jobs`
- Use the shared status enums from architecture:
  - asset status: `pending | processing | ready | failed | deleted`
  - job status: `queued | running | succeeded | failed | dead_letter`
- Phase 1 entries should default to `visibility_scope = 'authenticated'` so current app behavior is preserved while still fitting the future ACL model.
- Use a generic asset model linked to `entries` through `source_table` / `source_id` instead of bolting embeddings directly onto the `entries` table.
- Store chunk rows with:
  - weighted full-text search support
  - `embedding vector(1536)`
  - machine-usable `citation_locator` metadata
  - enough metadata to support later ranking/filtering without a schema redesign
- Entry chunking should be document-aware:
  - paragraph/section boundaries first
  - usually 1 to 3 chunks per entry
  - include title and important metadata in the first chunk
- The worker queue must be idempotent and safe to retry. Failed jobs should be visible in the database rather than silently disappearing.
- The implementation must make changed entry content searchable within 5 minutes of create or update in normal local/phase-1 conditions.
- Keep the assistant query contract aligned with the architecture shape: `mode: auto | search | ask`, named payload wrappers, and explicit `grounded` / `enough_evidence` response flags.
- The query path introduced here should prove entry-backed retrieval works, but it should stay search-first and minimal. Full hybrid ranking behavior, no-answer gating, and citation UX remain later-story work.
- Add `/api/assistant/health` in this story so the assistant shell can stop reporting "unavailable" in healthy RAG-enabled environments.

### Architecture Compliance

- Put all new assistant backend code under `server/rag/*`; do not keep growing `server/index.ts` or `server/db.ts` with retrieval and indexing internals.
- Keep worker logic outside `server/index.ts`.
- Preserve the current auth boundary: session cookie, `useAuth()`, and same-origin `/api` requests.
- Do not load assistant search results or corpus state through `/api/bootstrap` or `useAppData()`.
- Keep the route at `/ai/query` and keep `src/pages/AIQuery.tsx` thin.
- Preserve named API payload wrappers and `{ message }` error responses.
- Keep uploads/private storage work out of this story even if the data model already reserves those fields and statuses.

### Library and Framework Requirements

- **Embeddings:** Use `text-embedding-3-small` for entry chunk embeddings. The current Azure model docs indicate third-generation embeddings support adjustable dimensions and that `text-embedding-3-small` uses a default/max size of 1536 dimensions. Inference for this story: keep the initial schema at the full 1536 dimensions defined in the architecture to avoid premature dimension-tuning churn during the first migration.
- **Vector search:** Use `pgvector` with HNSW indexes for the first ANN path. The current pgvector README documents HNSW query tuning via `hnsw.ef_search`, warns that filtered ANN queries can lose recall, and adds iterative scans starting in pgvector 0.8.0. Build the query path so filtered searches can raise `hnsw.ef_search` or opt into iterative scans instead of assuming default recall is enough.
- **Full-text search:** Use PostgreSQL text search with GIN indexes on the weighted `tsvector` column. PostgreSQL's current text-search docs still describe GIN as the preferred text-search index type for many applications.
- **Fuzzy title matching:** Enable `pg_trgm` and use trigram indexes for title / filename-like matching. PostgreSQL's current `pg_trgm` docs show GIN/GiST support for similarity plus `LIKE` / `ILIKE`, which fits the future known-item search path.
- **Client state:** Reuse the existing root `QueryClientProvider`; do not create a second query client or move assistant calls back into ad hoc page-level `fetch` code.
- **Generation/extraction providers:** Do not wire full `gpt-4.1-mini`, `gpt-4.1-nano`, or Mistral extraction workflows into the runtime path unless this story truly needs them. Story 1.2 is about corpus/index readiness first.

### File Structure Requirements

- Create these new backend locations:
  - `server/migrations/001_rag_base.sql`
  - `server/migrations/002_rag_indexes.sql`
  - `server/migrations/003_rag_jobs.sql`
  - `server/rag/types.ts`
  - `server/rag/schemas.ts`
  - `server/rag/db.ts`
  - `server/rag/chunking.ts`
  - `server/rag/ingestion.ts`
  - `server/rag/jobs.ts`
  - `server/rag/routes.ts`
  - `server/rag/service.ts`
  - `server/workers/rag-worker.ts`
  - `server/test/rag/*`
- Update these existing files rather than bypassing them:
  - `server/index.ts`
  - `server/config.ts`
  - `server/db.ts`
  - `.env.example`
  - `package.json`
  - `docker-compose.yml`
- Extend the assistant feature only where this story truly needs it:
  - `src/features/assistant/api.ts`
  - `src/features/assistant/hooks/*`
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/test/assistant/*`
- Keep `src/pages/AIQuery.tsx` as the existing route wrapper and keep global data flows unchanged for the rest of the app.

### Testing Requirements

- The repo currently has meaningful assistant client tests, but the current `vitest.config.ts` only includes `src/**/*.{test,spec}.{ts,tsx}`. Update test configuration so backend RAG tests actually run in CI/local verification.
- Add server tests for:
  - migration runner idempotence
  - entry backfill into `knowledge_assets` / `knowledge_asset_versions` / `knowledge_chunks`
  - version supersession when an entry is updated
  - job retry/dead-letter behavior for failed indexing work
  - minimal `/api/assistant/query` search over indexed entry content
- Add assistant client tests for:
  - backend availability becoming healthy when `/api/assistant/health` succeeds
  - submitting a known-item query and rendering entry-backed results from the real backend path
  - no regression to local keyword fallback or fake answer copy
- Recommended verification commands for the implementation agent:
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - any targeted worker/migration command introduced by this story

### Previous Story Intelligence

- Story 1.1 deliberately removed `buildLocalAnswer`, local keyword filtering, and any disconnected assistant fallback. Do not bring that behavior back to "fake" Story 1.2 success.
- Story 1.1 established `src/features/assistant/*` as the feature boundary. Keep building inside that folder instead of leaking assistant behavior into unrelated pages or global providers.
- The Story 1.1 review notes already identified one backend gap: the assistant feature should not report an enabled environment as unavailable. The proper fix here is a real `/api/assistant/health` endpoint, not more client-side guesswork.
- The mobile evidence/filter surfaces added in Story 1.1 are placeholders. They can remain placeholder-first in this story if a thin result rendering proves the live corpus works without locking in later UX details too early.

### Git Intelligence Summary

- Recent implementation work is concentrated in commit `5a19af6` (`feat: replace AIQuery with assistant workspace shell`), which added the assistant feature folder, assistant tests, and shell label changes.
- The remaining recent commits are planning/readiness updates rather than runtime architecture changes, so there is no existing RAG backend implementation to preserve.
- The working tree was clean during story creation.

### Latest Tech Information

- Azure model documentation published in late March 2026 continues to describe `text-embedding-3-small` as a third-generation embedding model with a configurable `dimensions` parameter and a default/max output size of 1536 dimensions. That matches the architecture's `vector(1536)` decision for this first slice.
- The current `pgvector` README documents HNSW indexing, per-query `hnsw.ef_search`, filtered-query recall caveats, iterative scans, and hybrid-search guidance that explicitly pairs vector search with PostgreSQL full-text search and optional Reciprocal Rank Fusion. That is the right retrieval foundation for Story 1.2 even if later stories add the full hybrid scorer.
- PostgreSQL's current documentation still recommends GIN indexes for text search in many cases and documents `pg_trgm` GIN/GiST operator classes for fast similarity, `LIKE`, and `ILIKE` searching. Those are the correct primitives for the entry-title / keyword side of the corpus.

### Project Structure Notes

- The current repo still has a flat `server/` directory with no `rag`, `migrations`, `workers`, or backend test folders. Story 1.2 is the first story that should introduce that structure.
- `docker-compose.yml` currently defines only `db` and `api`. A `worker` service is part of the architecture handoff and should land here rather than in an external queue/service.
- `QueryClientProvider` is already mounted in `src/App.tsx`, and Story 1.1 already uses React Query for assistant availability. Continue that direction for assistant-specific server state.
- `useAppData()` still bootstraps all business CRUD collections. Assistant corpus and retrieval state should stay separate from that provider.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Requirements Inventory
  - Additional Requirements
  - Epic 1 overview
  - Story 1.2 acceptance criteria
  - Stories 1.3 through 1.6 for sequencing boundaries
- `_bmad-output/planning-artifacts/prd.md`
  - Executive Summary
  - Technical Success
  - MVP scope
  - Functional requirements FR7 and FR25
  - Non-functional requirements for freshness, security, and observability
- `_bmad-output/planning-artifacts/architecture.md`
  - Brownfield Guardrails
  - Data Architecture
  - API & Communication Patterns
  - Retrieval & Answering Architecture
  - Implementation Patterns & Consistency Rules
  - Project Structure & Boundaries
  - Implementation Handoff
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Page Regions
  - Query Modes And Response Selection
  - Search-Result Style Response
  - Reuse And Implementation Notes
  - Brownfield Guardrails
- `_bmad-output/planning-artifacts/research/technical-nerve-rag-assistant-research-2026-04-05.md`
  - Chunking Strategy, Metadata Model, and PostgreSQL/pgvector Schema
  - Hybrid Retrieval Approach
  - Background Jobs, Retries, Re-indexing, and Failure Handling
  - API Changes Needed in the Express Server
  - Testing, Observability, and Evaluation Strategy
  - Model and Platform Notes
- `_bmad-output/project-context.md`
  - Technology Stack & Versions
- `docs/index.md`
  - For AI-Assisted Development
  - Highest-Risk Areas To Understand First
- `docs/architecture-api-server.md`
  - Architecture Pattern
  - Data Architecture
  - Startup Behavior
  - Testing Strategy
- `docs/architecture-web-client.md`
  - Provider Stack
  - Data Flow
  - Integration Boundaries
- `docs/data-models-api-server.md`
  - Active PostgreSQL Schema
  - `entries`
  - Extension Usage
- `docs/development-guide-api-server.md`
  - Common Backend Change Workflows
  - Recommended Checks Before Merging Backend Work
- `docs/development-guide-web-client.md`
  - Active Frontend Data Model
  - Common Change Workflows
- `src/App.tsx`
  - Existing `QueryClientProvider`
  - Existing `/ai/query` route registration
- `src/hooks/useAuth.tsx`
  - Existing auth/session usage
- `src/hooks/useAppData.tsx`
  - Existing bootstrap data model to avoid for assistant retrieval
- `src/features/assistant/api.ts`
  - Existing assistant availability contract and `/assistant/health` expectation
- `src/features/assistant/components/AssistantPage.tsx`
  - Existing shell and transcript extension points
- `src/test/assistant/AssistantPage.test.tsx`
  - Existing assistant shell regression coverage
- `server/index.ts`
  - Existing monolithic route/startup shape
  - Existing entry endpoints and missing update/reindex path
- `server/db.ts`
  - Existing bootstrap DDL
  - Existing `entries` CRUD surface
- `server/config.ts`
  - Existing env/config loading surface
- `package.json`
  - Existing scripts and missing worker command
- `docker-compose.yml`
  - Existing `db` + `api` topology and missing `worker` service
- https://learn.microsoft.com/azure/ai-services/openai/concepts/models
- https://raw.githubusercontent.com/pgvector/pgvector/master/README.md
- https://www.postgresql.org/docs/current/textsearch-indexes.html
- https://www.postgresql.org/docs/current/pgtrgm.html

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story creation workflow: `bmad-create-story`
- Sprint status auto-discovery selected `1-2-index-existing-entries-as-the-phase-1-knowledge-corpus`
- Previous story context reviewed from `1-1-replace-the-legacy-aiquery-page-with-the-assistant-workspace.md`
- Repo constraints reviewed from:
  - `server/index.ts`
  - `server/db.ts`
  - `server/config.ts`
  - `src/features/assistant/*`
  - `vitest.config.ts`
  - `docker-compose.yml`
- Latest tech check sources:
  - Azure model documentation
  - pgvector README
  - PostgreSQL text-search and `pg_trgm` documentation

### Completion Notes List

- Added a migration-managed RAG foundation with `knowledge_assets`, `knowledge_asset_versions`, `knowledge_chunks`, `knowledge_acl_principals`, and `knowledge_jobs`, plus a migration runner executed by both the API and worker.
- Implemented the new `server/rag/*` module family, a PostgreSQL-backed reindex queue, `server/workers/rag-worker.ts`, initial entry backfill, idempotent retry/dead-letter handling, and shared reindex triggers from `POST /api/entries` plus the new `PATCH /api/entries/:id`.
- Wired the assistant shell to real backend availability and search-first entry-backed results through `/api/assistant/health` and `/api/assistant/query`, while keeping Phase 1 scoped to `source_kind = 'entry'` and avoiding local fallback answers.
- Added dedicated server RAG tests, extended assistant client regression coverage, updated stale API/data-model/development docs, and verified the implementation with `npm run lint`, `DATABASE_URL=postgres://nerve_app:test-pass@172.20.0.2:5432/nerve npm test`, and `npm run build`.

### File List

- `.env.example`
- `.env.local.example`
- `_bmad-output/implementation-artifacts/1-2-index-existing-entries-as-the-phase-1-knowledge-corpus.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docker-compose.yml`
- `docs/api-contracts-api-server.md`
- `docs/data-models-api-server.md`
- `docs/development-guide-api-server.md`
- `docs/index.md`
- `eslint.config.js`
- `package-lock.json`
- `package.json`
- `scripts/dev-local.sh`
- `server/config.ts`
- `server/db.ts`
- `server/index.ts`
- `server/migrations/001_rag_base.sql`
- `server/migrations/002_rag_indexes.sql`
- `server/migrations/003_rag_jobs.sql`
- `server/rag/chunking.ts`
- `server/rag/db.ts`
- `server/rag/ingestion.ts`
- `server/rag/jobs.ts`
- `server/rag/routes.ts`
- `server/rag/schemas.ts`
- `server/rag/service.ts`
- `server/rag/types.ts`
- `server/test/rag/rag.integration.test.ts`
- `server/test/rag/test-utils.ts`
- `server/workers/rag-worker.ts`
- `src/features/assistant/api.ts`
- `src/features/assistant/components/AssistantComposer.tsx`
- `src/features/assistant/components/AssistantPage.tsx`
- `src/features/assistant/components/AssistantTranscript.tsx`
- `src/features/assistant/hooks/useAssistantQuery.ts`
- `src/features/assistant/types.ts`
- `src/lib/api.ts`
- `src/lib/app-types.ts`
- `src/test/assistant/AssistantPage.test.tsx`
- `vitest.server.config.ts`

### Change Log

- 2026-04-05: Created Story 1.2 with full corpus-indexing, migration, worker, and assistant-integration guardrails; advanced sprint status to `ready-for-dev`.
- 2026-04-05: Implemented the Phase 1 entry-backed corpus foundation, assistant query path, worker/runtime wiring, tests, and documentation updates; advanced story status to `review`.
