# Story 1.3: Deliver Permission-Safe Entry Search

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Nerve user,
I want the assistant to search only the entries I can access,
so that results, snippets, and source actions stay trustworthy and private.

**FRs implemented:** FR13, FR20, FR21

## Acceptance Criteria

1. Given an authenticated user submits a query, when retrieval candidates are built, then the assistant evaluates access using the current session, role, team, ownership, and visibility rules, and unauthorized entries are excluded before snippets or citations are assembled.
2. Given a query returns results, when the result list is rendered, then each result includes only authorized title, snippet, and source metadata, and no blocked-source names, counts, or teaser actions are exposed.
3. Given a user attempts to preview or open a source they are not authorized to access, when the request reaches the API, then the request is rejected with an authorization error, and the response does not leak protected source metadata.
4. Given a blocked-source regression test is executed, when assistant retrieval and source-open flows are validated, then the leakage rate for unauthorized filenames, snippets, citations, and links is zero, and the test outcome is recorded as a launch-quality gate.

## Tasks / Subtasks

- [x] Introduce authoritative assistant ACL evaluation and request-scoped actor context (AC: 1, 3)
  - [x] Add `server/rag/acl.ts` with a single decision path that evaluates `authenticated`, `team`, `owner`, and `explicit_acl` visibility using the current session user, role, team, asset ownership, and `knowledge_acl_principals`.
  - [x] Extend the assistant route/service flow so `POST /api/assistant/query` and any new source-action endpoints receive the authenticated actor context from the existing session gate instead of querying anonymously inside `server/rag/service.ts`.
  - [x] Update the entry-to-asset projection in `server/rag/db.ts` so Phase 1 assets continue to default to `visibility_scope = 'authenticated'` but also persist `owner_user_id` and `owner_team_id` derived from `entries.created_by` and the creator's team for later ACL checks.
  - [x] Keep the architecture call chain intact: `route -> zod schema -> service -> acl/db helpers -> response mapper`; do not embed ACL SQL composition directly in route handlers.

- [x] Enforce ACL before any assistant search result data is shaped or returned (AC: 1, 2)
  - [x] Update `searchEntryKnowledge(...)` to accept actor context and enforce authorization inside SQL or tightly coupled DB helpers so blocked assets are removed before snippet generation, citation shaping, and result counting.
  - [x] Preserve the current Phase 1 corpus scope of `source_kind = 'entry'`, but stop hard-coding `ka.visibility_scope = 'authenticated'` as the only rule.
  - [x] Ensure all result counts, citations, and follow-up suggestions reflect only accessible assets; blocked assets must not appear as disabled cards, hidden counts, or empty teasers.
  - [x] Keep hybrid-search groundwork compatible with Story 1.4 by applying ACL during candidate generation, not as a loose UI-only or post-response filter.

- [x] Add authenticated Phase 1 source preview and open flows for entry results (AC: 2, 3)
  - [x] Add assistant-specific source-action endpoints under `/api/assistant/*` for result preview and open behavior, using named payload wrappers and `{ message }` failures.
  - [x] For entry-backed results, return only permission-safe preview data needed for the assistant context panel or mobile sheet, such as excerpt, entry metadata, and safe open target information.
  - [x] Reject unauthorized preview/open requests with `403` and no protected title, snippet, citation locator, filename, or count data in the response body.
  - [x] Reuse the existing authenticated product surface for open behavior where practical, for example by deep-linking into the internal browse/detail experience rather than introducing a public file URL or bypassing the app shell.

- [x] Surface permission-safe actions in the assistant UI without skipping ahead to citation-specific Story 1.6 behavior (AC: 2, 3)
  - [x] Extend `src/features/assistant/types.ts`, `src/features/assistant/api.ts`, and assistant hooks to carry per-result action availability and preview payloads from the backend contract.
  - [x] Update assistant result rendering so result cards show `Preview` and `Open source` only when the backend has authorized those actions; do not render disabled or blocked placeholders.
  - [x] Use the existing `AssistantContextPanel` and mobile sheet/drawer surfaces to show a selected entry preview without redesigning the full evidence-rail and citation-selection UX reserved for Story 1.6.
  - [x] Keep assistant data in feature-scoped React Query hooks; do not route preview/open state through `useAppData()` or `/api/bootstrap`.

- [x] Add blocked-source security and regression coverage as a launch gate (AC: 4)
  - [x] Extend `server/test/rag/rag.integration.test.ts` with cases that create or mutate entry-backed assets into `team`, `owner`, and `explicit_acl` scopes, then verify unauthorized users receive zero leaked results, snippets, citations, or source-open metadata.
  - [x] Add server tests for authorized access paths so preview/open still work for permitted users and continue returning Phase 1 entry-backed payloads.
  - [x] Extend `src/test/assistant/AssistantPage.test.tsx` to verify blocked actions are omitted from result cards, permission failures surface safe error copy, and no hidden-source teaser text appears.
  - [x] Capture the blocked-source suite as a named launch-quality regression gate in test descriptions and any touched docs/contracts.

- [x] Update supporting contracts and docs impacted by permission-safe retrieval (AC: 1, 2, 3, 4)
  - [x] Update `docs/api-contracts-api-server.md` for the revised assistant query result shape and the new preview/open endpoint contracts.
  - [x] Update `docs/data-models-api-server.md` if asset ownership/team ACL projection or source-action payloads change materially.
  - [x] Refresh any assistant developer guidance that still implies open access to all Phase 1 entry results or omits the new ACL gate.

### Review Findings

- [x] [Review][Patch] Open-source target deep-links into an unfiltered browse/bootstrap surface that still loads all entries [server/rag/service.ts:103]
- [x] [Review][Patch] Reindexing resets scoped knowledge assets back to `authenticated`, which can silently widen access after an edit [server/rag/db.ts:243]
- [x] [Review][Patch] Preview/open mutations can apply stale responses after a new conversation or a later preview click [src/features/assistant/components/AssistantPage.tsx:171]

## Dev Notes

### Story Intent and Scope Boundaries

- This story is the ACL and trust-boundary hardening step for Phase 1 entry search.
- The primary goal is to ensure unauthorized assets are removed before the assistant shapes result metadata, snippets, citations, or source actions.
- This story should add the minimum entry-preview and source-open flow needed for permission-safe result cards, but it must not absorb Story 1.4 hybrid ranking, Story 1.5 grounded answers, or Story 1.6 citation-driven evidence verification.
- Do not reintroduce local keyword fallback, anonymous assistant behavior, or any bypass around the existing session-based `/api` boundary.
- Keep Phase 1 restricted to existing `entries`; uploads, PDFs, OCR, and download proxies remain later-story work.

### Epic and Cross-Story Context

- Epic 1 delivers a trusted assistant over the existing `entries` corpus before any mixed-media expansion.
- Story 1.1 already established the assistant shell, `src/features/assistant/*` boundary, and removal of fake/local assistant answers.
- Story 1.2 created the RAG schema, indexing worker, `server/rag/*` module family, and the first entry-backed `POST /api/assistant/query` path.
- Story 1.3 is where permission safety becomes authoritative for retrieval and source actions.
- Story 1.4 and Story 1.4a will improve ranking, intent routing, and filters once ACL-safe retrieval is reliable.
- Story 1.5 will add grounded answer generation and no-answer gating.
- Story 1.6 will add citation chips, evidence rail interactions, and entry evidence verification on top of the same protected source model.

### Current Code Intelligence

- `server/index.ts` already authenticates every `/api` request after login and exposes `getSessionUser(...)`, so the assistant stack can reuse the current session model without inventing a second auth boundary.
- `server/rag/routes.ts` validates assistant payloads and calls `executeAssistantQuery(...)`, but it currently does not pass the authenticated actor into the assistant service.
- `server/rag/service.ts` currently calls `searchEntryKnowledge(...)` with only query text and filters, so retrieval is effectively anonymous beyond the outer `/api` auth gate.
- `server/rag/db.ts` currently hard-codes `ka.visibility_scope = 'authenticated'` in `searchEntryKnowledge(...)`, which means the system does not yet honor `team`, `owner`, or `explicit_acl` visibility, nor does it exercise `knowledge_acl_principals`.
- `knowledge_assets` already has `owner_user_id`, `owner_team_id`, and `visibility_scope`, and `knowledge_acl_principals` already exists in the migration baseline, so the schema needed for authoritative ACL checks is present.
- `upsertEntryKnowledgeAsset(...)` currently projects `owner_user_id` from `entries.created_by` but does not populate `owner_team_id`; this story should close that projection gap so team-scoped visibility can be enforced.
- `src/features/assistant/components/AssistantTranscript.tsx` currently renders title, snippet, metadata badges, tags, and external links for every returned result and does not yet offer permission-aware preview/open actions.
- `AssistantContextPanel.tsx` is still a placeholder surface, which makes it the right low-risk place to host entry preview data in this story before Story 1.6 upgrades it into a citation-aware evidence rail.
- `src/pages/Browse.tsx` already gives the product an authenticated internal entry-browsing surface, which is a better open-target foundation than introducing any public assistant source URL.

### Technical Requirements

- Reuse the existing Express session and current user lookup as the only assistant auth boundary.
- Implement one shared ACL decision path for:
  - retrieval candidates
  - snippets
  - citations
  - preview payloads
  - open-source actions
- Enforce ACL before any user-visible result shaping. Blocked sources must not contribute titles, snippets, counts, citation labels, or suggested actions.
- Continue using `knowledge_assets`, `knowledge_asset_versions`, `knowledge_chunks`, and `knowledge_acl_principals` as derived retrieval structures; do not bolt permission logic directly onto `entries` search rendering.
- Keep `entries` authoritative for business content and user-created data. ACL projection for search should derive from existing user/team relationships, not replace them.
- Maintain named payload wrappers for assistant APIs and `{ message }` error responses.
- Unauthorized source preview/open requests must return `403` without protected metadata leakage.
- Preserve the current response shape foundations from Story 1.2:
  - `mode: auto | search | ask` on input
  - explicit `grounded` and `enough_evidence` on output
  - entry-backed result objects in Phase 1
- Do not add upload/download storage behavior, citation rail selection state, answer synthesis, or conversation persistence here.

### Architecture Compliance

- Put all new assistant backend code under `server/rag/*`; add `server/rag/acl.ts` instead of pushing permission logic back into `server/index.ts` or `server/db.ts`.
- Keep route handlers thin and free of SQL assembly or ACL branching logic.
- Preserve the current `/ai/query` route and assistant feature boundary under `src/features/assistant/*`.
- Do not move assistant retrieval or preview state into `/api/bootstrap` or `useAppData()`.
- Keep the assistant within the authenticated app shell for open-source behavior; no public `/uploads`-style bypasses are allowed.
- Continue using versioned migrations and existing RAG schema objects rather than inventing a parallel ACL store elsewhere.

### Library and Framework Requirements

- **React Query:** Keep assistant source actions in feature-scoped React Query hooks. The current TanStack Query docs continue to document `useMutation` with `mutateAsync`, `reset`, and `isPending`, which matches the repo's current mutation-based assistant query flow and supports preview/open actions without reintroducing component-level `fetch` calls.
- **pgvector / hybrid retrieval groundwork:** The current `pgvector` README warns that approximate vector indexes apply filtering after the index scan, which can reduce recall for filtered queries; starting in `pgvector` 0.8.0, iterative scans can automatically widen the scan when filters remove too many matches. Inference for this story: keep ACL predicates inside the retrieval query design so Story 1.4 can add vector/hybrid ranking without relying on unsafe post-filter-only authorization.
- **PostgreSQL text search:** PostgreSQL's current docs still position GIN as the preferred text-search index type for many workloads. Preserve the existing GIN-backed full-text path from Story 1.2 while layering ACL constraints on top of it.
- **Express / API conventions:** Keep using standard JSON `{ message }` errors and same-origin authenticated requests; do not introduce ad hoc fetch patterns or alternate session transport.

### File Structure Requirements

- Add these backend files if needed:
  - `server/rag/acl.ts`
- Update these backend files:
  - `server/index.ts`
  - `server/rag/routes.ts`
  - `server/rag/service.ts`
  - `server/rag/db.ts`
  - `server/rag/types.ts`
  - `server/rag/schemas.ts`
  - `server/test/rag/rag.integration.test.ts`
  - `docs/api-contracts-api-server.md`
  - `docs/data-models-api-server.md`
- Update these frontend files:
  - `src/features/assistant/api.ts`
  - `src/features/assistant/types.ts`
  - `src/features/assistant/hooks/useAssistantQuery.ts`
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/features/assistant/components/AssistantContextPanel.tsx`
  - `src/test/assistant/AssistantPage.test.tsx`
- Reuse rather than replace:
  - `src/pages/AIQuery.tsx` as the thin route wrapper
  - `src/pages/Browse.tsx` as a likely authenticated open-target surface for entries

### Testing Requirements

- Add server integration coverage for:
  - authenticated visibility scope access
  - team-scoped access and denial
  - owner-scoped access and denial
  - explicit ACL allow/deny cases
  - source preview/open `403` behavior with no metadata leakage
  - result counts/snippets/citations reflecting only authorized assets
- Add assistant UI coverage for:
  - permission-safe rendering of result metadata
  - omission of blocked `Preview` / `Open source` actions
  - safe error messaging on denied source actions
  - no blocked-source teaser text, hidden-count implication, or leaked metadata in the transcript/context surfaces
- Recommended verification commands for the implementation agent:
  - `npm run lint`
  - `npm test`
  - `npm run build`

### Previous Story Intelligence

- Story 1.2 intentionally stopped short of final ACL enforcement and source actions so the indexing/retrieval foundation could land first.
- Story 1.2 review work already hardened queueing, migration safety, and stale assistant response handling; build on those fixes rather than bypassing the new module boundaries.
- The current assistant query path already proves the indexed entry corpus works end-to-end. This story should harden that path, not replace it with a separate query surface.
- Story 1.1 and Story 1.2 both reinforced that assistant behavior belongs under `src/features/assistant/*` and `server/rag/*`; keep following that structure.

### Git Intelligence Summary

- The latest implementation commit is `0900153` (`feat: index entries for the phase 1 assistant corpus`), which touched the new `server/rag/*` modules, RAG migrations, assistant feature API/types/components, and RAG integration tests.
- That commit already established the exact files this story should extend, especially `server/rag/routes.ts`, `server/rag/service.ts`, `server/rag/db.ts`, `src/features/assistant/api.ts`, `src/features/assistant/types.ts`, and `src/test/assistant/AssistantPage.test.tsx`.
- The working tree was clean during story creation, so there are no outstanding local changes the implementation agent needs to work around.

### Latest Tech Information

- TanStack Query's latest React docs still expose `useMutation` with `mutateAsync`, `reset`, and `isPending`, which aligns with the current `useAssistantQuery()` approach and supports adding permission-safe source actions without breaking the existing assistant mutation flow.
- The current `pgvector` README notes that filtered approximate searches apply filters after index scan and may need higher `hnsw.ef_search` or iterative scans from `pgvector` 0.8.0 onward to preserve recall. This matters because future hybrid/vector retrieval must keep ACL constraints first-class instead of trusting a post-filtered result set.
- PostgreSQL's current text-search index documentation still recommends GIN as the preferred index type for many text-search workloads. The existing `knowledge_chunks.search_vector` indexing from Story 1.2 remains the correct base for Phase 1 search while ACL predicates are layered into the query.

### Project Structure Notes

- The assistant now has real backend/runtime boundaries under `server/rag/*` and `src/features/assistant/*`; this story should deepen those boundaries rather than cutting across them.
- The active app still has no dedicated entry detail route. Reusing or lightly extending the authenticated browse experience is the safest Phase 1 open-source target unless the implementation agent finds an equally thin internal detail flow already present.
- `useAppData()` remains the shared CRUD/bootstrap path for general app surfaces. Assistant retrieval and preview state should remain isolated from it.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Requirements Inventory
  - UX Design Requirements
  - Epic 1 overview
  - Story 1.3 acceptance criteria
  - Story 1.6 and Story 2.5a sequencing boundaries
- `_bmad-output/planning-artifacts/prd.md`
  - FR13, FR20, FR21
  - Security & Privacy
  - Reliability & Recoverability
  - Groundedness & Answer Quality
- `_bmad-output/planning-artifacts/architecture.md`
  - Decision Priority Analysis
  - Authentication & Security
  - API & Communication Patterns
  - Retrieval & Answering Architecture
  - Structure Patterns
  - Communication Patterns
  - Process Patterns
  - Enforcement Guidelines
  - Project Structure & Boundaries
  - Requirements To Structure Mapping
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Known-Item Search Flow
  - Search-Result Style Response
  - Evidence Rail
  - Source Opening Behavior
  - Permission-Safe Display Rules
- `_bmad-output/implementation-artifacts/1-2-index-existing-entries-as-the-phase-1-knowledge-corpus.md`
  - Story intent and scope boundaries
  - Current code intelligence
  - Architecture compliance
  - File structure requirements
  - Testing requirements
- `_bmad-output/project-context.md`
  - Technology Stack & Versions
- `server/index.ts`
  - Existing `/api` auth gate
  - `getSessionUser(...)`
  - Entry CRUD routes
- `server/rag/routes.ts`
  - Current assistant router shape
- `server/rag/service.ts`
  - Current anonymous query execution seam
- `server/rag/db.ts`
  - `upsertEntryKnowledgeAsset(...)`
  - `searchEntryKnowledge(...)`
- `server/migrations/001_rag_base.sql`
  - `knowledge_assets`
  - `knowledge_acl_principals`
- `src/features/assistant/components/AssistantTranscript.tsx`
  - Current result-card rendering
- `src/features/assistant/components/AssistantContextPanel.tsx`
  - Current preview/evidence placeholder surface
- `src/pages/Browse.tsx`
  - Existing authenticated browse surface for entry open behavior
- `src/test/assistant/AssistantPage.test.tsx`
  - Existing assistant shell and backend-result coverage
- `server/test/rag/rag.integration.test.ts`
  - Existing Story 1.2 backend coverage and login helpers
- https://tanstack.com/query/latest/docs/framework/react/reference/useMutation
- https://raw.githubusercontent.com/pgvector/pgvector/master/README.md
- https://www.postgresql.org/docs/current/textsearch-indexes.html

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story creation workflow: `bmad-create-story`
- Sprint status auto-discovery selected `1-3-deliver-permission-safe-entry-search`
- ACL implementation updated:
  - `server/rag/acl.ts`
  - `server/rag/db.ts`
  - `server/rag/routes.ts`
  - `server/rag/service.ts`
  - `server/rag/schemas.ts`
  - `server/rag/types.ts`
- Assistant UI contract and evidence-surface updates:
  - `src/features/assistant/api.ts`
  - `src/features/assistant/hooks/useAssistantQuery.ts`
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/features/assistant/components/AssistantContextPanel.tsx`
  - `src/pages/Browse.tsx`
- Regression and contract/docs updates:
  - `server/test/rag/rag.integration.test.ts`
  - `server/test/rag/test-utils.ts`
  - `src/test/assistant/AssistantPage.test.tsx`
  - `docs/api-contracts-api-server.md`
  - `docs/data-models-api-server.md`
  - `docs/development-guide-api-server.md`

### Completion Notes List

- Added a shared assistant ACL path and request-scoped actor context so query, preview, and open-source flows now evaluate `authenticated`, `team`, `owner`, and `explicit_acl` visibility from the active session before shaping any user-visible source data.
- Extended the assistant backend with permission-safe `/api/assistant/source-preview` and `/api/assistant/source-open` endpoints, owner/team projection in `knowledge_assets`, and ACL-filtered result actions plus browse deep-link open targets.
- Updated the assistant UI to render authorized `Preview` / `Open source` actions only, load safe entry previews into the context panel/mobile drawer, and surface safe authorization-error copy without hidden-source teaser placeholders.
- Added launch-quality regression coverage in both server and client test files and refreshed the API/data-model/development docs to reflect the new protected-source contract.
- Verified the implementation with `npm run build:client`, `npm run build:server`, `npm run lint`, and `npm run test:client -- --run src/test/assistant/AssistantPage.test.tsx`.
- `npm run test:server -- --run server/test/rag/rag.integration.test.ts` could not run in this workspace because `DATABASE_URL` / `TEST_DATABASE_URL` is not configured for the ephemeral Postgres-backed server suite.

### File List

- `_bmad-output/implementation-artifacts/1-3-deliver-permission-safe-entry-search.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/api-contracts-api-server.md`
- `docs/data-models-api-server.md`
- `docs/development-guide-api-server.md`
- `server/rag/acl.ts`
- `server/rag/db.ts`
- `server/rag/routes.ts`
- `server/rag/schemas.ts`
- `server/rag/service.ts`
- `server/rag/types.ts`
- `server/test/rag/rag.integration.test.ts`
- `server/test/rag/test-utils.ts`
- `src/features/assistant/api.ts`
- `src/features/assistant/components/AssistantContextPanel.tsx`
- `src/features/assistant/components/AssistantPage.tsx`
- `src/features/assistant/components/AssistantTranscript.tsx`
- `src/features/assistant/hooks/useAssistantQuery.ts`
- `src/features/assistant/types.ts`
- `src/pages/Browse.tsx`
- `src/test/assistant/AssistantPage.test.tsx`

### Change Log

- 2026-04-06: Moved Story 1.3 from `ready-for-dev` to `in-progress`, implemented ACL-aware assistant retrieval and source actions, extended the assistant UI/evidence surfaces, refreshed docs, added launch-gate regressions, and advanced the story to `review`.
