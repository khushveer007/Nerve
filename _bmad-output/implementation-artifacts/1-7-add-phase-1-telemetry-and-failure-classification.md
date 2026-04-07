# Story 1.7: Add Phase 1 Telemetry and Failure Classification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a product owner or operator,
I want request and failure telemetry for the assistant,
so that I can observe production behavior and triage issues quickly.

**FRs implemented (story source):** FR20, FR21, FR25

**Supporting PRD/NFR scope:** FR35, NFR26, NFR27

## Acceptance Criteria

1. Given an assistant request is processed, when the request completes or fails, then the system records a request ID, stage timings, mode, no-answer outcome, and failure classification, and retrieval, permission, and provider failures are distinguishable in telemetry.
2. Given entry indexing and retrieval activity occurs, when operational signals are recorded, then the system captures freshness, request, and latency indicators needed for Phase 1 operations, and the signals are available to product and engineering stakeholders.
3. Given regressions appear after rollout, when operators inspect the assistant signals, then they can identify whether the issue is retrieval quality, permission enforcement, or downstream provider instability, and the rollout can be governed with evidence instead of anecdote.

## Tasks / Subtasks

- [x] Add a lean Phase 1 observability foundation for assistant telemetry without shipping a dashboard surface yet. (AC: 1, 2, 3)
  - [x] Add a versioned migration under `server/migrations/` for assistant request telemetry persistence with indexes for request-id lookup, recent-time filtering, and failure/outcome grouping.
  - [x] Introduce typed observability helpers under `server/observability/*` or an equally isolated server-only module for request outcomes, failure classifications, stage timings, and structured event emission.
  - [x] Keep telemetry storage structured and queryable. Prefer typed columns plus `JSONB` for timing/provider metadata instead of free-form log blobs.
  - [x] Do not persist raw assistant answer text, source excerpts, or full private query text in this story. Story 1.7 is for operational telemetry, not transcript history or persisted answer evidence from Stories 4.x and 5.2.

- [x] Instrument the assistant query path with correlation ids, stage timings, outcomes, and degradation/failure classification. (AC: 1, 3)
  - [x] In `server/rag/service.ts`, measure at least mode resolution, embeddings, retrieval, evidence assessment, answer generation, and total request time for `/api/assistant/query`.
  - [x] Preserve the existing `request_id` as the success-path correlation id. If a request fails before `{ result }` can be returned, still generate and record a request id in telemetry without breaking the current `{ message }` error contract.
  - [x] Record requested mode, resolved mode, applied-filter summary, result count, citation count, grounded/no-answer outcome, and provider usage signals needed for launch telemetry.
  - [x] Distinguish retrieval failures from provider failures. Embedding timeout/degrade-to-lexical behavior and answer-provider fallback behavior must still emit provider-instability telemetry even when the user receives a graceful search or no-answer response.
  - [x] Treat no-answer as a valid operational outcome, not an error classification.

- [x] Instrument permission-safe source actions and indexing/job activity so operators can separate trust-boundary problems from corpus freshness problems. (AC: 1, 2, 3)
  - [x] Record request telemetry for `/api/assistant/source-preview` and `/api/assistant/source-open` with action type, request id, authorization outcome, and permission-failure classification for `403` paths.
  - [x] Emit queue/indexing telemetry from `server/rag/jobs.ts`, `server/rag/ingestion.ts`, and/or `server/workers/rag-worker.ts` for enqueue, success, retry, and dead-letter outcomes, reusing the existing `knowledge_jobs` lifecycle instead of inventing a second job system.
  - [x] Capture freshness indicators from existing `knowledge_assets`, `knowledge_asset_versions`, and `knowledge_jobs` timestamps/statuses rather than duplicating the same timing facts into a parallel freshness table.
  - [x] Keep Phase 1 telemetry entry-scoped. Do not pull mixed-media upload, PDF, OCR, download, or saved-thread analytics forward from later stories beyond generic job/failure plumbing already present.

- [x] Make the collected signals consumable by product and engineering stakeholders without building the later quality-insights UI early. (AC: 2, 3)
  - [x] Add a read-side helper, documented SQL/view, or similarly lean internal inspection mechanism for recent request outcomes, failure-classification counts, freshness lag, queue/dead-letter counts, and provider degradation counts.
  - [x] Update server-side docs with the telemetry schema, failure taxonomy, and operational investigation workflow so teams can use launch telemetry before Story 5.1 builds a dedicated review surface.
  - [x] Do not build dashboards, rollout scorecards, or the golden-query evaluation suite in this story. Those belong to Stories 1.8 and 5.x.

- [x] Add regression coverage for telemetry capture, failure classification, and non-regression of existing assistant behavior. (AC: 1, 2, 3)
  - [x] Extend `server/test/rag/rag.integration.test.ts` for successful search, grounded answer, no-answer, embedding timeout fallback, answer-provider fallback, preview/open `403`, and worker retry/dead-letter cases with assertions on emitted telemetry or persisted observability records.
  - [x] Add or extend unit/schema coverage for any new telemetry types, enums, migrations, or read-model helpers.
  - [x] Add a guard that telemetry-write failures do not replace the normal user-facing assistant result, no-answer, or `403` response with a new application failure.
  - [x] Keep existing client assistant tests green. Story 1.7 should not change the current `/ai/query` UX or regress the citation/evidence work delivered in Story 1.6.

### Review Findings

- [x] [Review][Patch] Denied preview/open telemetry stores blocked source identifiers [server/rag/service.ts:433]
- [x] [Review][Patch] Job telemetry misclassifies embedding payload/schema failures as retrieval failures [server/observability/helpers.ts:67]

## Dev Agent Record

### Implementation Plan

- Add a small server-side observability layer plus a migration-backed telemetry store that fits the existing `server/rag/*` and migration patterns.
- Instrument query, preview/open, and worker/indexing paths so request ids, timings, outcomes, and failure classifications are captured without changing the current assistant UX contract.
- Extend tests and docs so launch-time operations can inspect and trust the new telemetry before the later analytics UI exists.

### Debug Log

- Added `004_assistant_observability.sql` with request/job telemetry tables and indexes tuned for request-id lookup, recent slices, and failure/outcome grouping.
- Introduced `server/observability/*` helpers for typed failure taxonomy, stage timing capture, structured logging, request/job persistence, and operational read-side summaries.
- Instrumented `server/rag/service.ts` and `server/rag/jobs.ts` so query, preview/open, retry, dead-letter, stale-lock recovery, and fail-open telemetry all flow through the new observability layer without changing the existing API envelopes.
- Updated docs and regression coverage, then verified the server build plus targeted telemetry-focused server tests.

### Completion Notes

- Phase 1 assistant telemetry now persists correlation ids, mode resolution, stage timings, outcomes, provider degradation details, permission denials, and `knowledge_jobs` lifecycle events without storing raw prompts, answers, or source excerpts.
- Added an operational read model via `listRecentAssistantRequestTelemetry()` and `getAssistantOperationalSnapshot()`, plus SQL inspection guidance in the API server development guide.
- Verification completed with `npm run build:server`, `npm run test:server -- server/test/rag/rag.schemas.test.ts`, targeted telemetry integration slices for provider degradation/fallback, job telemetry, stale-lock recovery, fail-open behavior, and the legacy queue-failure regressions that had been blocked by the new telemetry schema.
- The broader `server/test/rag/rag.integration.test.ts` file still contains pre-existing non-Story-1.7 failures around older search/grounding/filter expectations; those are unchanged from this story and are called out for review context.

### File List

- server/migrations/004_assistant_observability.sql
- server/observability/helpers.ts
- server/observability/logger.ts
- server/observability/metrics.ts
- server/observability/types.ts
- server/rag/db.ts
- server/rag/jobs.ts
- server/rag/service.ts
- server/test/rag/rag.integration.test.ts
- server/test/rag/rag.schemas.test.ts
- docs/development-guide-api-server.md

### Change Log

- 2026-04-07: Added Phase 1 assistant request/job telemetry persistence, failure classification, operational read helpers, and regression coverage for Story 1.7.

## Dev Notes

### Story Intent and Scope Boundaries

- Story 1.7 is the Phase 1 collection layer for assistant operations telemetry, not the analytics or review UI.
- The goal is to capture enough structured evidence to explain request health, provider degradation, permission denials, and indexing freshness during launch rollout.
- Keep the current assistant route, transcript UX, and response rendering behavior intact. This story should be operationally valuable with little or no user-facing UI churn.
- Do not pull evaluation harness work, launch scorecards, persisted answer evidence, saved threads, private uploads, PDF/image analytics, or review dashboards forward from Stories 1.8, 4.x, or 5.x.
- Telemetry must never become a second trust leak. Do not store blocked titles, snippets, citation locators, or other private source content in operational signals.

### Epic and Cross-Story Context

- Epic 1 replaces the legacy AIQuery page with a trustworthy assistant over existing entry knowledge.
- Story 1.2 introduced `knowledge_assets`, `knowledge_asset_versions`, `knowledge_chunks`, and `knowledge_jobs`; those existing timestamps and job states are the foundation for freshness and ingestion telemetry.
- Story 1.3 centralized ACL-safe retrieval plus source preview/open behavior. Story 1.7 should classify permission failures around those existing trust boundaries, not invent a second authorization path.
- Story 1.4 and Story 1.4a established deterministic mode routing, hybrid retrieval, filter handling, and result-count behavior. Telemetry must preserve the distinction between requested mode, resolved mode, and retrieval outcome so operators can explain system behavior.
- Story 1.5 delivered server-enforced no-answer behavior. No-answer must be recorded as a valid outcome, not as an error.
- Story 1.6 made citations interactive and wired preview/open actions into the evidence rail. Story 1.7 should now capture source-preview/source-open activity and correlate it to request ids where appropriate, without redesigning the UI.
- Story 1.8 remains out of scope. Collect telemetry now, but leave golden-query evaluation, launch gates, and release-governance automation for the next story.

### Current Code Intelligence

- `server/rag/service.ts` already generates a `request_id` for `/api/assistant/query`, handles embedding fallback, and converts answer-provider failures into safe search/no-answer responses. This is the primary seam for request telemetry and degradation classification.
- `server/rag/routes.ts` keeps route handlers thin and already maps preview/open authorization denials to `403`. Permission telemetry should hook here or immediately beneath it without moving business logic into the route layer.
- `server/rag/embeddings.ts` and `server/rag/answering.ts` already expose timeout, HTTP-status, and invalid-payload failures through specific error messages that can be normalized into provider failure classes.
- `server/rag/jobs.ts` already handles enqueue, retry, stale-lock recovery, success, and dead-letter transitions for `knowledge_jobs`. Reuse those transitions as observability signals instead of inventing a parallel background-work tracker.
- `server/rag/db.ts` and the existing migrations already provide the versioned-SQL pattern the architecture requires. Telemetry persistence should follow the same migration discipline.
- `src/features/assistant/components/AssistantPage.tsx` already uses successful query `request_id` values for request-scoped evidence selection, but there is no telemetry review surface yet. Keep Story 1.7 server-heavy and let Story 5.1 build the review UI later.
- The repo currently has no `server/observability/*` directory even though the architecture reserves that boundary. Add it rather than scattering telemetry concerns across routes, services, and worker loops.

### Technical Requirements

- Distinguish at least `retrieval_failure`, `permission_failure`, and `provider_failure` at the top level. If you add finer-grained subtypes such as `embedding_provider_failure` or `answer_provider_failure`, keep them roll-up-friendly.
- Provider degradations that fall back gracefully must still be recorded. An embedding timeout that degrades to lexical retrieval is still operationally important even if the user gets results.
- Preserve the current `{ result }` success envelope and `{ message }` failure envelope. Do not redesign the assistant API contract just to expose telemetry.
- Use request-scoped correlation ids, not global mutable state.
- Stage timings should be measured on the server path that actually owns the work. Avoid client-derived timing as the source of truth for operations telemetry.
- Observability must fail open. If telemetry persistence/logging fails, capture that secondary issue safely and still return the original assistant result, no-answer response, or permission denial whenever possible.
- Avoid storing raw assistant answers, raw question text, or private source content in this story. Store ids, counts, enums, timestamps, and summarized metadata needed for rollout operations.
- Keep all timestamps in UTC/ISO 8601 and follow the architecture rule that display formatting belongs in the UI layer, not the persisted telemetry shape.

### Architecture Compliance

- Put new telemetry helpers under `server/observability/*` or another explicitly isolated server-only boundary, not in client components or `useAppData()`.
- Keep the assistant request flow aligned with the documented chain: `route -> zod schema -> service -> retrieval/answering/acl helpers -> db/providers -> response mapper`.
- Keep new schema objects as versioned SQL migrations under `server/migrations/`.
- Reuse `server/rag/*` for assistant-domain instrumentation and `knowledge_*` tables for freshness/job state instead of pushing observability into `server/index.ts`.
- If a read-side operational surface is added in this story, keep it authenticated and narrow. Do not introduce public telemetry endpoints or a user-facing dashboard.

### Library and Framework Requirements

- **Express 4.21.2 / TypeScript 5.8 / Zod 3.25:** Preserve the existing route validation and named JSON payload patterns while adding observability hooks.
- **PostgreSQL 16 / pg 8.16.3:** Use versioned migrations and structured persistence (`JSONB` is acceptable for timings/provider metadata). Keep UTC timestamps and indexed lookup paths for operational queries.
- **React 18.3.1 / TanStack React Query 5.83.0:** The current client already treats assistant work as request-scoped mutations/queries. Story 1.7 should not introduce a new client-state library or telemetry dashboard state model.
- **Existing provider configuration in `server/config.ts`:** Reuse the current answer/embedding model configuration seams; telemetry should report provider/model usage without hard-coding a second provider configuration system.

### File Structure Requirements

- Expected new or updated server files:
  - `server/migrations/004_assistant_observability.sql` or similarly named follow-on migration
  - `server/observability/logger.ts`
  - `server/observability/metrics.ts`
  - `server/rag/service.ts`
  - `server/rag/routes.ts`
  - `server/rag/types.ts`
  - `server/rag/jobs.ts`
  - `server/rag/ingestion.ts` if indexing instrumentation belongs there
  - `server/workers/rag-worker.ts` if worker-start/loop events need telemetry hooks
  - `server/test/rag/rag.integration.test.ts`
  - `server/test/rag/rag.schemas.test.ts` or new telemetry-specific tests
  - `docs/development-guide-api-server.md`
  - `docs/api-contracts-api-server.md` only if a user-visible or operator-visible API contract changes

- Reuse rather than replace:
  - the existing `request_id` field in `AssistantQueryResult`
  - the current `knowledge_jobs` retry/dead-letter lifecycle
  - the current `/api/assistant/source-preview` and `/api/assistant/source-open` trust boundary
  - the current no-answer fallback behavior in `server/rag/service.ts`
  - the current migration runner in `server/rag/db.ts`

### Testing Requirements

- Add server coverage for successful search and grounded-answer requests emitting telemetry with request id, resolved mode, timings, and result/citation counts.
- Add server coverage that no-answer outcomes are recorded distinctly from failures.
- Add server coverage that embedding timeout/degrade-to-lexical behavior emits provider-instability telemetry without breaking the returned search response.
- Add server coverage that answer-provider timeout/failure emits provider-instability telemetry while preserving the current safe fallback behavior.
- Add server coverage that preview/open `403` paths emit `permission_failure` telemetry without leaking blocked source metadata.
- Add worker/job coverage for queue, retry, stale-lock recovery, success, and dead-letter observability signals.
- Add a regression guard that telemetry write failure does not become the user-visible failure.
- Recommended verification commands for the implementation agent:
  - `npm run test:server -- server/test/rag/rag.schemas.test.ts`
  - `npm run test:server -- server/test/rag/rag.integration.test.ts`
  - `npm run lint`
  - `npm run build:server`

### Previous Story Intelligence

- Story 1.6 already made citations actionable and request-scoped across the evidence rail, mobile drawer, preview, and open flows. Telemetry should now observe those flows, not redesign them.
- Story 1.6 reinforced the principle that `/api/assistant/query`, `/api/assistant/source-preview`, and `/api/assistant/source-open` are the only Phase 1 evidence boundaries. Story 1.7 should instrument those boundaries, not add a telemetry-specific side path through the client.
- Story 1.6 also extended docs and tests together with contract changes. Keep that same discipline here even if most changes land on the server side.
- Story 1.6 explicitly deferred telemetry, failure classification, and evaluation. That sequencing is now important: implement the collection layer, but stop short of Story 1.8 guardrails and Story 5.x review UI.

### Git Intelligence Summary

- The latest commit `ee5d5b3` (`feat: enhance citation handling and evidence selection in assistant`) touched `server/rag/*`, assistant UI components, docs, tests, and the BMAD story artifact together. That confirms the current repo pattern: full-stack assistant changes land with docs/tests, not as server-only quick hacks.
- The prior commit `f03c2a7` (`feat: enhance assistant query handling with grounded responses and citations`) added the current answer-provider path, no-answer behavior, and expanded server tests. Story 1.7 should instrument those seams rather than reworking the grounded-answer design.
- Recent assistant changes consistently avoid `useAppData()` and keep assistant state feature-local. Telemetry collection should follow the same separation and stay server-centric until a later review surface is built.

### Latest Tech Information

- As of 2026-04-07, TanStack Query's latest React docs still center request-driven side effects around `useMutation`, which matches the repo's current assistant request pattern and does not justify a new client-state layer for Story 1.7 observability.
  - Source: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
- As of 2026-04-07, Microsoft Learn's Azure AI Foundry model availability docs list `gpt-4.1-mini`, `gpt-4.1-nano`, and `text-embedding-3-small`, which matches the architecture and `server/config.ts` assumptions used by the current assistant runtime.
  - Source: https://learn.microsoft.com/en-us/azure/ai-foundry/azure-openai-in-ai-foundry
- As of 2026-04-07, the official `pgvector` project docs note that approximate indexes apply filtering after the index scan and recommend raising `hnsw.ef_search` or using iterative scans when filtering would otherwise under-return rows. Inference for this story: record retrieval counts and provider/vector degradation signals so operators can distinguish ranking/coverage issues from permission or provider failures.
  - Source: https://github.com/pgvector/pgvector
- As of 2026-04-07, PostgreSQL's current GIN documentation still positions GIN as the scalable index family for text-search-style workloads and emphasizes operational tuning tradeoffs. Inference for this story: keep the current lexical leg intact and add observability around it rather than redesigning retrieval in the telemetry story.
  - Source: https://www.postgresql.org/docs/current/gin.html

### Project Structure Notes

- The architecture already reserves `server/observability/*`, but the repo has not created that boundary yet. Story 1.7 is the right time to introduce it in a narrow, typed way.
- The assistant already exposes `request_id` on successful query results, but there is no current review UI. Keep collection and operator guidance on the server side now so Story 5.1 can build on real telemetry later.
- The biggest implementation risk is letting telemetry writes or logging failures change the assistant's user-visible behavior or add unnecessary latency. Prefer careful instrumentation, typed helpers, and operationally cheap writes over ad hoc logging inside hot paths.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Story 1.7 acceptance criteria
  - NFR26 and NFR27
  - Story 1.8 and Epic 5 sequencing boundaries
- `_bmad-output/planning-artifacts/prd.md`
  - MVP launch telemetry requirement
  - FR35 and observability requirements
  - no-answer, permission-safety, and rollout-governance context
- `_bmad-output/planning-artifacts/architecture.md`
  - Observability section
  - Retrieval & Answering Architecture
  - API & Communication Patterns
  - Implementation Patterns & Consistency Rules
  - `server/observability/*` project structure guidance
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Query Modes And Response Selection
  - Grounded Answer Flow
  - No-Evidence / Low-Confidence Flow
- `_bmad-output/project-context.md`
  - Technology Stack & Versions
- `_bmad-output/implementation-artifacts/1-6-add-citation-inspection-and-entry-evidence-verification.md`
  - current evidence/source-open seams
  - Story 1.7 sequencing note
- `server/rag/service.ts`
  - request-id generation
  - safe fallback and answer/no-answer behavior
- `server/rag/routes.ts`
  - thin route ownership and preview/open `403` handling
- `server/rag/embeddings.ts`
  - timeout and provider error handling
- `server/rag/answering.ts`
  - answer-provider timeout/failure behavior
- `server/rag/jobs.ts`
  - retry, stale-lock recovery, and dead-letter seams
- `server/rag/db.ts`
  - migration runner and `knowledge_*` state/timestamps
