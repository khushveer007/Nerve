# Story 1.4: Add Hybrid Search and Intent Routing for Entry Queries

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Nerve user,
I want the assistant to return strong search results for discovery-style queries,
so that I can quickly find the right entry without leaving the assistant workflow.

**FRs implemented:** FR6, FR7, FR8, FR9, FR10, FR18

## Acceptance Criteria

1. Given a user submits a known-item or discovery query in `Search` mode or `Auto` mode, when the request is processed, then the assistant returns a search-style response with ranked entry results, and ranking combines semantic similarity, exact match behavior, and metadata-aware retrieval.
2. Given the query intent is ambiguous, when the request is processed in `Auto` mode, then the system chooses search-style or answer-style behavior using server-side routing rules, and the response shape remains explainable from the returned evidence.
3. Given no accessible entries match the request, when the response is returned, then the assistant shows a neutral no-results state with refinement suggestions, and the user can retry without retyping the original query.

## Tasks / Subtasks

- [x] Add deterministic server-side intent routing for `Auto` queries without skipping ahead to grounded answer generation (AC: 2)
  - [x] Add an intent-resolution helper under `server/rag/*` that classifies `auto` turns into `search` or `ask` using deterministic rules based on verbs, phrasing, and known-item cues from the UX spec and architecture.
  - [x] Keep `Search` and `Ask` explicit user choices authoritative; only `auto` should be reclassified by the server.
  - [x] Preserve explainability in the response contract by returning the resolved mode in the existing `result.mode` field and keeping `grounded` / `enough_evidence` semantics explicit.
  - [x] If `auto` resolves to `ask` before Story 1.5 lands, return an evidence-backed search result set with `answer: null` rather than fabricating answer text. This is an implementation-sequencing guardrail inferred from the current epic order.

- [x] Upgrade entry retrieval from the current weighted keyword path to an explainable hybrid retrieval pipeline (AC: 1)
  - [x] Rework `searchEntryKnowledge(...)` so candidate generation is split into metadata-aware exact match, PostgreSQL full-text search, trigram/title similarity, and vector similarity paths over `knowledge_chunks`.
  - [x] Use ACL-safe candidate union plus reciprocal rank fusion or an equivalently explainable fusion strategy, matching the architecture direction instead of piling more weights into one monolithic SQL score.
  - [x] Keep ACL enforcement inside candidate generation and fusion, not as a UI-only or post-response filter.
  - [x] Continue collapsing to the best chunk per asset for Phase 1 entry cards unless the implementation introduces a better adjacent-chunk collapse that still preserves permission safety and clear citation locators.

- [x] Reuse the existing embedding configuration instead of duplicating provider logic for query-time semantic retrieval (AC: 1)
  - [x] Extract or share the embedding request helper currently buried in `server/rag/ingestion.ts` so ingestion and query-time embedding calls use one implementation.
  - [x] Generate a query embedding only when `ASSISTANT_EMBEDDING_URL` is configured; when embeddings are unavailable, degrade safely to metadata + FTS + trigram retrieval without breaking the route.
  - [x] Keep the current fixed `1536`-dimension schema and `text-embedding-3-small` default unless a broader architecture change is made intentionally.

- [x] Improve the search-style response contract and UI copy for routed discovery turns and no-results outcomes (AC: 1, 2, 3)
  - [x] Extend the assistant response types only as far as needed to support routed-mode rendering and refinement suggestions; do not add citation-inspection or saved-thread state here.
  - [x] Update the assistant transcript/page rendering so search-oriented turns feel intentionally search-first, and routed `ask` turns remain transparent about why no narrative answer is shown yet.
  - [x] Add a low-friction retry path for zero-result turns so users can re-run or refine the original request without manually reconstructing it from memory.
  - [x] Keep the filter drawer placeholder scoped to Story 1.4a; do not build Phase 1 facets, summary rows, or `Show more results` controls in this story.

- [x] Preserve clear story boundaries with adjacent Epic 1 work (AC: 1, 2, 3)
  - [x] Do not implement grounded answer generation, evidence-threshold prompting, or citation chips from Story 1.5 and Story 1.6.
  - [x] Do not pull Phase 1 facet UI, filter persistence, result-summary rows, or `Show more results` behavior forward from Story 1.4a.
  - [x] Keep the corpus restricted to Phase 1 `entries`; uploads, PDFs, OCR, and mixed-media ranking stay in later epics.

- [x] Add hybrid-ranking, routing, and no-results regression coverage plus contract/docs updates (AC: 1, 2, 3)
  - [x] Extend `server/test/rag/rag.integration.test.ts` with cases covering exact-title queries, semantically similar queries, ACL-safe hybrid ranking, deterministic auto routing, and zero-result refinement suggestions.
  - [x] Add assistant UI tests for routed-mode messaging, neutral no-results copy, and retry/refinement behavior without retyping the original query.
  - [x] Update API and developer docs that currently describe Phase 1 query behavior as only search-first fallback so they reflect routed-mode semantics and query-time hybrid retrieval.

### Review Findings

- [x] [Review][Patch] Vector retrieval has no relevance floor, so embedding-enabled environments can return unrelated nearest-neighbor entries instead of the required neutral no-results state. [`server/rag/db.ts:843`](/home/opsa/Work/Nerve/server/rag/db.ts#L843)
- [x] [Review][Patch] Auto routing checks known-item cues before synthesis phrasing, so prompts like `Summarize the ... policy memo.` resolve to `search` instead of the intended routed `ask` behavior. [`server/rag/intent.ts:80`](/home/opsa/Work/Nerve/server/rag/intent.ts#L80)
- [x] [Review][Patch] Query-time embedding requests have no timeout or abort path, so a slow or hanging embedding provider can block the whole assistant query instead of degrading safely to lexical retrieval. [`server/rag/embeddings.ts:21`](/home/opsa/Work/Nerve/server/rag/embeddings.ts#L21)

## Dev Notes

### Story Intent and Scope Boundaries

- This story is the retrieval-quality and intent-routing step for Phase 1 entry-backed assistant search.
- The primary goal is to turn the current ACL-safe keyword/trigram path into a true hybrid retrieval pipeline that can perform well for both known-item and discovery queries.
- This story must also make `Auto` mode real on the server. Today, `auto` effectively collapses to search except for the current `ask` passthrough.
- Story 1.4 should not fake grounded answers. If the server decides a turn is answer-oriented before Story 1.5 exists, it should stay transparent and evidence-led instead of inventing prose.
- Keep Phase 1 restricted to existing `entries`. Mixed-media retrieval, upload governance, and download proxies are later work.

### Epic and Cross-Story Context

- Epic 1 is delivering a trusted assistant over existing Nerve entries before broader corpus expansion.
- Story 1.1 established the assistant workspace shell and transcript behavior in `src/features/assistant/*`.
- Story 1.2 created the RAG schema, chunking/indexing path, `knowledge_chunks.embedding`, and the initial entry-backed query route.
- Story 1.3 made retrieval and source actions permission-safe and added preview/open flows that must remain authoritative here.
- Story 1.4 focuses on retrieval quality and routed behavior, not full answer generation.
- Story 1.4a adds visible Phase 1 filters, active chips, five-result summaries, and `Show more results`.
- Story 1.5 adds grounded answer generation, server-enforced no-answer behavior, and answer-mode payloads that actually contain answer text.
- Story 1.6 adds citation chips, evidence rail interaction, and entry evidence verification on top of the same protected source model.

### Current Code Intelligence

- `server/rag/service.ts` currently resolves output mode with `input.mode === "ask" ? "ask" : "search"`, so `auto` has no real server-side routing yet.
- `server/rag/service.ts` always returns `answer: null`, `grounded: false`, and search-style results. This is correct for current sequencing but means Story 1.4 must be explicit about routed `ask` behavior.
- `server/rag/db.ts` already has a useful starter ranking path that combines `ts_rank_cd(...)`, trigram `similarity(ka.title, $1)`, title substring boosts, and content substring boosts, but it is still one SQL path rather than the hybrid candidate-generation and fusion pipeline the architecture calls for.
- `server/rag/db.ts` already applies ACL and metadata filters inside the retrieval SQL. That safety boundary must stay intact when hybrid candidate sources are added.
- `server/rag/ingestion.ts` already knows how to call the configured embedding endpoint for chunk embeddings. Query-time semantic retrieval should reuse or extract that helper rather than duplicate the HTTP logic.
- `server/migrations/002_rag_indexes.sql` already provisions `pg_trgm`, a GIN index for `search_vector`, and an HNSW index for `knowledge_chunks.embedding`, so the database groundwork for hybrid retrieval is already in place.
- `server/config.ts` already exposes `ASSISTANT_QUERY_RESULT_LIMIT` and the embedding config. There is no current query-classifier config, which is a strong signal to start with deterministic routing rules for Story 1.4.
- `src/features/assistant/components/AssistantPage.tsx` currently submits `EMPTY_FILTERS`, treats the result as search-first copy, and reserves filters/evidence drawers for later stories.
- `src/features/assistant/components/AssistantTranscript.tsx` renders a count badge, a `Grounded` or `Search-first` badge, and result cards, but it does not yet distinguish routed `ask` turns beyond the generic summary string.

### Technical Requirements

- Keep using the existing Express session and assistant actor context as the only trust boundary.
- Implement hybrid retrieval over `knowledge_chunks` and `knowledge_assets`; do not fall back to direct `entries` scanning in routes or client code.
- Preserve ACL enforcement for every candidate source used in ranking, snippets, and source actions.
- Treat hybrid retrieval as metadata-aware exact matching + FTS + trigram similarity + vector similarity, not just another weighted keyword query.
- Reuse the current embedding configuration and fixed `1536` vector schema for query embeddings.
- Keep response payloads explicit and machine-readable:
  - named wrapper `{ result }`
  - `mode: "search" | "ask"` as the resolved mode
  - `grounded` and `enough_evidence` still present
  - `{ message }` on failures
- Do not introduce speculative answer text, citation chips, evidence-rail selection state, or persistence here.
- Preserve `ASSISTANT_QUERY_RESULT_LIMIT` behavior unless Story 1.4a explicitly changes visible pagination or expansion behavior.

### Architecture Compliance

- Keep new backend assistant logic under `server/rag/*`; do not grow `server/index.ts` or `server/db.ts` with routing or ranking logic.
- Preserve the call chain `route -> zod schema -> service -> retrieval helpers -> db/providers -> response mapper`.
- Prefer extracting a shared embedding helper module over duplicating provider calls in `service.ts` and `ingestion.ts`.
- Keep `src/pages/AIQuery.tsx` as the thin route wrapper and continue housing assistant behavior in `src/features/assistant/*`.
- Do not move assistant query state into `useAppData()` or `/api/bootstrap`.
- Maintain Phase 1 entry-only source cards and permission-safe preview/open actions.

### Library and Framework Requirements

- **TanStack React Query 5:** Keep assistant queries and source actions in feature-scoped mutation hooks. The current React docs still document `useMutation` around `mutate`, `mutateAsync`, `reset`, and pending/error state handling, which matches the existing hook pattern and is sufficient for routed-mode and retry UI changes.
- **pgvector:** The current `pgvector` guidance notes that filtered approximate searches apply filters after index scan and can lose recall. Starting with `0.8.0`, iterative index scans can widen the scan when filtering removes too many matches. Inference for this story: keep ACL and metadata filters first-class in query design, and be careful not to ship a vector path that under-retrieves protected-but-authorized results.
- **PostgreSQL full-text search:** PostgreSQL documentation still positions GIN as the preferred text-search index type for many workloads. The existing `knowledge_chunks.search_vector` GIN index remains the correct backbone for the keyword/FTS portion of hybrid retrieval.

### File Structure Requirements

- Update these backend files:
  - `server/rag/service.ts`
  - `server/rag/db.ts`
  - `server/rag/types.ts`
  - `server/rag/schemas.ts`
  - `server/test/rag/rag.integration.test.ts`
  - `docs/api-contracts-api-server.md`
  - `docs/development-guide-api-server.md`
- Consider adding one shared backend helper if it reduces duplication cleanly:
  - `server/rag/intent.ts`
  - `server/rag/embeddings.ts` or `server/rag/providers/embeddings.ts`
- Update these frontend files:
  - `src/features/assistant/api.ts`
  - `src/features/assistant/types.ts`
  - `src/features/assistant/hooks/useAssistantQuery.ts`
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/test/assistant/AssistantPage.test.tsx`
- Reuse rather than replace:
  - `src/features/assistant/components/AssistantContextPanel.tsx`
  - `src/pages/AIQuery.tsx`
  - the existing preview/open-source route and ACL path from Story 1.3

### Testing Requirements

- Add server integration coverage for:
  - exact-title and exact-phrase ranking
  - semantic similarity ranking when query embeddings are available
  - safe fallback ranking when embeddings are unavailable
  - deterministic `auto` routing for clear retrieval intents
  - deterministic `auto` routing for clear synthesis intents
  - ambiguous `auto` routing behavior that stays explainable and non-speculative
  - zero-result responses that include neutral refinement suggestions
  - ACL-safe hybrid ranking so unauthorized assets still never appear in fused results
- Add assistant UI coverage for:
  - routed-mode messaging in the transcript
  - neutral no-results presentation
  - retry/refine affordances without rebuilding the original query manually
  - preserving permission-safe preview/open actions on result cards after the ranking changes
- Recommended verification commands for the implementation agent:
  - `npm run lint`
  - `npm test`
  - `npm run build:server`
  - `npm run build`

### Previous Story Intelligence

- Story 1.3 deliberately centralized ACL checks into `server/rag/acl.ts`, routed actor context through the assistant request path, and kept preview/open flows permission-safe. Story 1.4 must preserve that single decision path.
- Story 1.3 also added assistant-specific preview/open contracts and UI state. Do not regress those actions while changing ranking or routed-mode messaging.
- Story 1.3 review fixes already addressed stale preview/open responses across new conversations and later clicks. Any retry UI added here must respect the same request-scoping patterns.
- Story 1.3 explicitly called out Story 1.4 as the place to improve hybrid ranking once ACL-safe retrieval was stable. Follow that seam rather than reworking the trust boundary again.

### Git Intelligence Summary

- The latest implementation commit is `d2d2f6f` (`feat: deliver permission-safe assistant entry search`), which touched `server/rag/*`, the assistant feature components/hooks/types, docs, and server/client tests.
- The previous Phase 1 corpus commit is `0900153` (`feat: index entries for the phase 1 assistant corpus`), which established the chunk/search schema, embedding storage, migrations, and assistant query flow this story should extend.
- The current working tree was clean while this story was created, so the implementation agent does not need to work around unrelated local edits.

### Latest Tech Information

- TanStack Query's current React reference continues to document `useMutation` as the standard pattern for request-scoped mutation state, including `mutateAsync`, `reset`, and explicit pending/error status handling. That matches the current assistant query and source-action hooks and does not require a client-state architecture change.
- The current `pgvector` README warns that approximate vector indexes apply filters after index scan and may return too few rows when filters are selective. It recommends increasing scan breadth and notes that iterative index scans are available from `0.8.0`. This matters directly for ACL-safe assistant retrieval because protected-source filtering can shrink the candidate set after vector search.
- PostgreSQL's full-text search docs continue to position GIN indexes as the preferred general-purpose choice for `tsvector` search. The existing `knowledge_chunks_search_vector_idx` remains the right foundation for the exact/keyword leg of hybrid retrieval.

### Project Structure Notes

- The repo already has the right backend/frontend split for this story: `server/rag/*` for retrieval logic and `src/features/assistant/*` for UI behavior.
- The current assistant page still intentionally leaves filters and richer answer UX for later stories. Preserve that sequencing instead of turning Story 1.4 into a combined ranking, filters, and answer-generation refactor.
- The most likely reinvention risk is duplicating embedding HTTP code or adding alternate retrieval logic outside `server/rag/db.ts` and `server/rag/service.ts`. Avoid both.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Story 1.4 acceptance criteria
  - Story 1.4a and Story 1.5 sequencing boundaries
  - Requirements inventory and Epic 1 scope
- `_bmad-output/planning-artifacts/prd.md`
  - MVP scope
  - Launch-quality measurable outcomes
  - Hybrid retrieval product requirement
- `_bmad-output/planning-artifacts/architecture.md`
  - Core architectural decisions
  - Retrieval & Answering Architecture
  - Implementation patterns and consistency rules
  - Phase 1 query flow
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Query Modes And Response Selection
  - Auto Mode Rules
  - Known-Item Search Flow
- `_bmad-output/project-context.md`
  - Technology Stack & Versions
- `_bmad-output/implementation-artifacts/1-3-deliver-permission-safe-entry-search.md`
  - Previous story intelligence
  - ACL and preview/open guardrails
- `server/config.ts`
  - assistant query-result and embedding configuration
- `server/rag/ingestion.ts`
  - current embedding helper implementation
- `server/rag/service.ts`
  - current resolved-mode and response-shaping logic
- `server/rag/db.ts`
  - current ranking query and ACL-safe metadata filtering
- `server/migrations/002_rag_indexes.sql`
  - `pg_trgm`, GIN, and HNSW index baseline
- `src/features/assistant/components/AssistantPage.tsx`
  - current empty-filter submission flow and retry seams
- `src/features/assistant/components/AssistantTranscript.tsx`
  - current search-first rendering behavior

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm run test:client -- src/test/assistant/AssistantPage.test.tsx`
- `npm run lint`
- `npm run build:server`
- `npm run build`
- `set -a && source /home/opsa/Work/Nerve/.env.local && npm run test:server -- server/test/rag/rag.integration.test.ts` (blocked by `ECONNREFUSED 127.0.0.1:5432`; local test database was not reachable from the host test runner)

### Completion Notes List

- Added deterministic `auto` intent routing under `server/rag/*` while keeping explicit `search` and `ask` selections authoritative and keeping routed `ask` turns evidence-led with `answer: null`.
- Replaced the monolithic retrieval SQL with an ACL-safe hybrid pipeline that fuses metadata-aware exact matches, PostgreSQL FTS, trigram similarity, and optional vector similarity while still collapsing to one result chunk per asset.
- Extracted shared embedding request logic so ingestion and query-time semantic retrieval use the same configuration and degrade safely when embeddings are unavailable.
- Updated the assistant page/transcript to make routed `ask` turns transparent, show neutral zero-result copy, and provide one-click retry or edit actions without retyping the original query.
- Updated assistant API and development docs for resolved-mode semantics and hybrid retrieval.
- Client validation passed for the assistant UI path, and lint plus server/client builds passed.
- Server integration tests remain environment-blocked because the configured PostgreSQL endpoint on `127.0.0.1:5432` was unreachable from the host test runner in this session.

### File List

- `_bmad-output/implementation-artifacts/1-4-add-hybrid-search-and-intent-routing-for-entry-queries.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/api-contracts-api-server.md`
- `docs/development-guide-api-server.md`
- `server/rag/db.ts`
- `server/rag/embeddings.ts`
- `server/rag/ingestion.ts`
- `server/rag/intent.ts`
- `server/rag/service.ts`
- `server/rag/types.ts`
- `server/test/rag/rag.integration.test.ts`
- `src/features/assistant/components/AssistantPage.tsx`
- `src/features/assistant/components/AssistantTranscript.tsx`
- `src/features/assistant/constants.ts`
- `src/test/assistant/AssistantPage.test.tsx`

### Change Log

- 2026-04-06: Implemented Story 1.4 hybrid retrieval, deterministic `auto` routing, routed/no-results assistant UX updates, regression coverage, and related API/developer documentation updates.
