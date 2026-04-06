# Story 1.4a: Add Filtered Entry Result Lists and Phase 1 Facets

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Nerve user,
I want to narrow entry-backed results with visible filters,
So that I can refine discovery without leaving the assistant workflow.

**FRs implemented:** FR4, FR10, FR12

## Acceptance Criteria

1. Given a user applies supported Phase 1 filters such as department, date range, or sort, when a query is submitted, then the API applies those filters to retrieval and ranking, and active filters remain visible as removable chips across turns until cleared.
2. Given one or more filters are active, when the user chooses `Clear all`, then the active filter set is removed in one action, and the next query runs without the previously applied facets unless the user selects them again.
3. Given privileged entry metadata is available and the user's role permits it, when filter controls are shown, then optional facets such as team, owner, and visibility scope may appear, and later-phase facets such as indexing status are not treated as Phase 1 requirements.
4. Given more than five accessible results are found, when the result group is displayed, then the page shows a summary row with result count and active facets, and the UI initially renders five results with a `Show more results` control.
5. Given entry-backed results are rendered, when the result list is displayed, then each result includes entry-specific descriptors such as title, metadata, and snippet content, and the presentation remains clearly scoped to Phase 1 entry sources.

## Tasks / Subtasks

- [ ] Replace the placeholder assistant filter contract with a Phase 1 facet model that matches the planning artifacts instead of exposing the current temporary metadata arrays as the final UX. (AC: 1, 2, 3)
  - [ ] Update `server/rag/types.ts`, `server/rag/schemas.ts`, `src/features/assistant/types.ts`, and any touched API helpers so the request contract cleanly supports required Phase 1 controls:
    - department
    - inclusive date range
    - sort (`relevance` default, `newest` optional)
  - [ ] Treat privileged filters (`team`, `owner`, `visibility_scope`) as optional additions only when they can be backed by authoritative assistant data without breaking the current architecture boundaries.
  - [ ] Do not ship the current placeholder visible filter UX as `entry_types`, `priorities`, and `tags` just because those fields already exist in code. If they remain internally, keep them out of the Phase 1 visible control set unless intentionally justified and aligned with the planning artifacts.
  - [ ] Preserve explicit named payload wrappers and request-scoped assistant state; do not move assistant filter state into `useAppData()` or `/api/bootstrap`.

- [ ] Apply the new Phase 1 filters and sort options inside the existing ACL-safe retrieval path instead of as client-side post-processing. (AC: 1, 3, 5)
  - [ ] Extend `searchEntryKnowledge(...)` and related types/helpers so department, date range, and sort are enforced inside the retrieval query over `knowledge_assets` / `knowledge_chunks`.
  - [ ] Keep ACL, `source_kind = 'entry'`, and hybrid candidate generation authoritative before ranking, snippets, counts, and actions are assembled.
  - [ ] Implement `sort = relevance` as the existing hybrid ranking path and `sort = newest` as a deterministic server-side ordering using authoritative entry date data plus stable tie-breakers.
  - [ ] If privileged filters are surfaced, filter by authoritative assistant fields such as `owner_team_id`, `owner_user_id`, and `visibility_scope`; do not infer them from display strings or client-only state.
  - [ ] Guard date filtering against blank or malformed metadata so unsupported values degrade safely instead of causing SQL/runtime errors.

- [ ] Deliver visible filter controls, removable chips, and `Clear all` behavior across the existing desktop and mobile assistant surfaces. (AC: 1, 2, 3)
  - [ ] Replace the placeholder filter copy in `AssistantContextPanel` or a new assistant-specific filter component with real controls wired to the active assistant filter state.
  - [ ] Keep the existing `Filters` button, desktop rail/sheet pattern, and mobile drawer/sheet pattern; do not redesign the shell.
  - [ ] Render every active facet as a removable chip near the composer/transcript flow, and keep those chips persistent across turns in the current session until explicitly cleared.
  - [ ] Do not clear filters on `New conversation`; that action resets transcript context, not session-scoped filter state. Only direct chip removal or `Clear all` should remove active facets.
  - [ ] Gate privileged controls by authenticated role/context and available metadata, and omit them entirely when they are not meaningful.

- [ ] Add a search-style summary row and five-result reveal behavior without pulling full answer-mode or later-phase search features forward. (AC: 4, 5)
  - [ ] Update transcript/result rendering so each assistant response shows a summary row with result count and the exact facets that were applied to that turn.
  - [ ] Snapshot the applied filters per submitted turn so old transcript messages do not silently change when the current session filters are edited later.
  - [ ] Initially render five result cards per turn and add a `Show more results` control when the returned result set is larger than five.
  - [ ] Adjust `ASSISTANT_QUERY_RESULT_LIMIT` defaults or another server-backed mechanism so the client can actually reveal more than five results without faking pagination.
  - [ ] Keep result cards entry-specific and preserve existing permission-safe `Preview` and `Open source` actions.

- [ ] Preserve story boundaries with adjacent Epic 1 work. (AC: 1, 2, 3, 4, 5)
  - [ ] Do not pull grounded answer synthesis, evidence-threshold gating, or no-answer generation forward from Story 1.5.
  - [ ] Do not pull citation-chip selection UX or evidence-verification flows forward from Story 1.6.
  - [ ] Do not add mixed-media content types, indexing-status facets, upload-state UI, or download actions from later epics.
  - [ ] Keep Phase 1 scoped to entry-backed result cards and assistant-local filtering only.

- [ ] Add regression coverage and docs updates for the Phase 1 filter/result experience. (AC: 1, 2, 3, 4, 5)
  - [ ] Extend `server/test/rag/rag.integration.test.ts` with cases for department filtering, inclusive date filtering, `newest` sort ordering, safe behavior when dates are missing/malformed, and any privileged filters that are surfaced.
  - [ ] Add assistant UI coverage for visible chips, per-chip removal, `Clear all`, session persistence across turns, `New conversation` preserving filters, and `Show more results`.
  - [ ] Verify result cards still show entry descriptors and permission-safe preview/open actions after filtering and collapsed-result rendering changes.
  - [ ] Update assistant API/developer docs so they describe the new filter contract, visible Phase 1 facets, and any result-summary/show-more behavior accurately.

### Review Findings

- [x] [Review][Patch] Validate calendar dates before SQL casting can turn malformed filter input into runtime failures [server/rag/schemas.ts:6]
- [x] [Review][Patch] `sort = newest` still prunes candidates through relevance-first ranking before date ordering, so newer matches can disappear before sorting is applied [server/rag/db.ts:723]
- [x] [Review][Patch] `total_results` is counted after capped candidate pruning, so summary rows and evidence state can under-report accessible matches for broad queries [server/rag/db.ts:998]
- [x] [Review][Patch] Story intelligence notes still describe the pre-change `EMPTY_FILTERS` contract and `ASSISTANT_QUERY_RESULT_LIMIT = 5`, which leaves the new artifact internally inconsistent [/_bmad-output/implementation-artifacts/1-4a-add-filtered-entry-result-lists-and-phase-1-facets.md:90]

## Dev Notes

### Story Intent and Scope Boundaries

- This story is the Phase 1 facet and search-results presentation step for the trusted entry assistant.
- The primary goal is to make filtering visible and useful without breaking the ACL-safe hybrid retrieval foundation from Stories 1.3 and 1.4.
- The visible Phase 1 control set should match the planning artifacts: department, date range, and sort first; privileged facets only when they are authoritative and low-risk.
- This story should not absorb grounded answer generation, inline citations, evidence verification, mixed-media filters, saved history, or broader browse/search redesign work.
- Keep the corpus restricted to existing `entries` and the current assistant workspace at `/ai/query`.

### Epic and Cross-Story Context

- Epic 1 is delivering a trusted assistant over existing Nerve entries before broader corpus expansion.
- Story 1.1 established the assistant shell, transcript, and `Filters` button/drawer placeholder at `/ai/query`.
- Story 1.2 created the RAG schema, query route, and entry-backed corpus over `knowledge_*` tables.
- Story 1.3 made retrieval, preview, and open actions permission-safe and established the authoritative ACL path.
- Story 1.4 added deterministic `auto` routing and ACL-safe hybrid retrieval, but intentionally deferred visible facets, summary rows, and five-result reveal behavior to this story.
- Story 1.5 will add grounded answer generation and server-enforced no-answer behavior.
- Story 1.6 will add citation chips, evidence inspection, and entry evidence verification on top of the same protected search surface.

### Current Code Intelligence

- `src/features/assistant/components/AssistantPage.tsx` now keeps assistant filter state locally, preserves it across turns, and submits the normalized Phase 1 filter contract with each query.
- `src/features/assistant/components/AssistantContextPanel.tsx` now hosts the real filter panel on desktop and mobile assistant surfaces without changing the shell layout.
- `src/features/assistant/components/AssistantTranscript.tsx` now renders summary rows, per-turn applied filter chips, and five-result reveal behavior for assistant responses.
- `server/rag/schemas.ts` and `server/rag/types.ts` now encode the Phase 1 filter contract (`department`, inclusive `date_range`, `sort`) and the response metadata used by transcript history (`applied_filters`, `total_results`).
- `server/rag/db.ts` continues to own ACL-safe hybrid retrieval and now applies the Phase 1 filters plus deterministic `newest` ordering inside the authoritative query path.
- `server/config.ts` and `.env*.example` now default `ASSISTANT_QUERY_RESULT_LIMIT` to `20`, allowing the client to reveal more than the initial five result cards without faking pagination.
- `src/lib/constants.ts` already exposes `DEPARTMENTS`, which should be reused for Phase 1 department facet options rather than inventing a second department vocabulary.
- `server/rag/service.ts` already returns explicit machine-readable result payloads and request-scoped follow-up suggestions; keep that explicit contract style while evolving filters and result-summary behavior.

### Technical Requirements

- Keep the existing Express session and assistant actor context as the only trust boundary.
- Apply filters and sort on the server, before response shaping. Do not fake filtered views by hiding cards on the client after retrieval.
- Keep `relevance` as the default sort and preserve the hybrid retrieval stack from Story 1.4.
- Treat date range filtering as inclusive on both boundaries and use stable server-side semantics so the UI and tests stay deterministic.
- Preserve entry-specific descriptors already returned on result cards: title, metadata badges, snippet, and permission-safe actions.
- Persist active filters across turns in the current session until explicitly cleared.
- Snapshot the applied filter set for each submitted turn so transcript history remains accurate after later filter edits.
- Do not expose blocked-source counts, titles, snippets, or facet hints through filtering UI, result summaries, or chips.
- If privileged filters are surfaced:
  - derive them from authoritative assistant data only
  - omit them when the actor role or metadata does not support them
  - keep them ACL-safe and server-enforced
- Do not require a new assistant bootstrap payload just to render facet controls.

### Architecture Compliance

- Keep backend assistant work under `server/rag/*`; do not move filtering/ranking logic into `server/index.ts` or `server/db.ts`.
- Preserve the route -> schema -> service -> retrieval helpers -> db flow.
- Keep `src/pages/AIQuery.tsx` as the thin route wrapper and implement assistant behavior under `src/features/assistant/*`.
- Keep assistant request and UI state feature-local and React Query-backed; do not move assistant filters/results into `useAppData()`.
- Reuse the current desktop/mobile surfaces:
  - desktop filter rail/sheet behavior
  - mobile drawer/sheet behavior
  - current transcript and context panel shells
- Continue using the same protected source preview/open path from Story 1.3.

### Library and Framework Requirements

- **TanStack React Query 5:** Keep assistant queries and any follow-on filter-driven requests in feature-scoped hooks built around the existing mutation pattern. The current React reference continues to document `useMutation`, `mutateAsync`, and `reset` as the expected request-scoped workflow, so this story does not need a global state-store rewrite.
- **pgvector:** The current `pgvector` README notes that approximate vector indexes apply filters after index scan and can lose recall when filtering is selective. Inference for this story: keep ACL and any new server-side facets first-class in the retrieval query design instead of trusting client-side hiding or overly late post-filtering.
- **PostgreSQL full-text search:** Current PostgreSQL docs continue to recommend GIN-backed text-search indexes for many workloads. The existing hybrid retrieval/query indexes remain the right base; add filter/sort behavior without replacing hybrid retrieval with client-side ranking.
- **shadcn/ui-style surfaces already in the repo:** Prefer the existing `Sheet`, `Drawer`, `Card`, `Badge`, and `Button` patterns already used in the assistant shell instead of introducing a new filter UI library.

### File Structure Requirements

- Update these backend files:
  - `server/config.ts`
  - `server/rag/types.ts`
  - `server/rag/schemas.ts`
  - `server/rag/service.ts`
  - `server/rag/db.ts`
  - `server/test/rag/rag.integration.test.ts`
  - `docs/api-contracts-api-server.md`
  - `docs/development-guide-api-server.md`
- Update these frontend files:
  - `src/features/assistant/types.ts`
  - `src/features/assistant/api.ts`
  - `src/features/assistant/hooks/useAssistantQuery.ts`
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantContextPanel.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/test/assistant/AssistantPage.test.tsx`
- Reuse rather than replace:
  - `src/pages/AIQuery.tsx`
  - `src/features/assistant/components/AssistantHeader.tsx`
  - `src/lib/constants.ts` for department vocabulary
  - the existing preview/open source flow from Story 1.3
- Consider adding one focused assistant UI component if it keeps the filter logic isolated and readable:
  - `src/features/assistant/components/AssistantFiltersPanel.tsx`

### Testing Requirements

- Add server integration coverage for:
  - department filtering on authorized results
  - inclusive date-range filtering
  - `newest` sort behavior with stable tie-breakers
  - safe behavior when entry-date metadata is blank or malformed
  - privileged `team`, `owner`, and/or `visibility_scope` facets if they are surfaced
  - ACL-safe filtering so blocked assets still never affect visible cards, counts, chips, or result summaries
- Add assistant UI coverage for:
  - visible active chips after a filtered query
  - per-chip removal
  - `Clear all`
  - filters persisting across turns
  - `New conversation` preserving filter selections
  - summary row rendering with result count and applied facets
  - five-result initial rendering plus `Show more results`
  - preserved entry-specific preview/open actions after filtering
- Recommended verification commands for the implementation agent:
  - `npm run lint`
  - `npm test`
  - `npm run build:server`
  - `npm run build`

### Previous Story Intelligence

- Story 1.4 deliberately deferred visible facets, summary rows, and `Show more results` to this story. That sequencing boundary should stay explicit.
- Story 1.4 already made `auto` routing explainable and kept routed `ask` turns evidence-led with `answer: null`. This story must preserve that transparency while improving search-style rendering.
- Story 1.4 extracted shared embeddings logic and stabilized hybrid retrieval. Reuse that retrieval pipeline instead of branching into a second search implementation for filtered results.
- Story 1.3 centralized ACL checks in `server/rag/acl.ts` and made preview/open actions permission-safe. Do not regress those actions while changing result grouping or filter UI.
- Story 1.3 also fixed stale preview/open state after conversation changes. Any new per-turn filter chips or `Show more` state should be scoped by message/turn, not as a single global toggle that mutates older transcript turns.

### Git Intelligence Summary

- The latest relevant commit is `08d9e22` (`feat: Implement hybrid search and intent routing enhancements with embedding timeout and distance configurations`), which means the hybrid retrieval and routed-mode seams are already in place for this story to extend.
- The prior assistant retrieval commit `d2d2f6f` (`feat: deliver permission-safe assistant entry search`) established the current ACL-safe preview/open and result-card behavior this story must preserve.
- The current working story order and sprint tracker place `1-4a` immediately after the completed hybrid-search story, which is the right time to land visible Phase 1 facets without mixing in Story 1.5 answer synthesis.

### Latest Tech Information

- TanStack Query's current React reference continues to document `useMutation`, `mutateAsync`, and explicit mutation reset/state handling as the normal request-scoped workflow. That matches the current assistant query hook pattern and supports filter-driven submissions without introducing a global client-state refactor.
- The current `pgvector` README warns that approximate vector indexes apply filters after index scan and can under-return when filters are selective. This matters directly for assistant facets because ACL plus optional privileged filters should remain part of the authoritative retrieval design, not a UI-only afterthought.
- PostgreSQL's current text-search docs continue to position GIN indexes as the preferred general-purpose index type for `tsvector` search. The existing full-text path should remain part of the hybrid retrieval stack while this story adds filter and sort behavior around it.

### Project Structure Notes

- The repo already has the correct brownfield seams for this story:
  - backend assistant logic under `server/rag/*`
  - UI implementation under `src/features/assistant/*`
  - thin page wrapper under `src/pages/AIQuery.tsx`
- The assistant shell already includes a `Filters` entry point on both desktop and mobile. This story should turn that seam into working UX, not replace the page structure.
- `useAppData()` remains the app-wide bootstrap/CRUD layer for broader screens. Assistant filter state should remain isolated from it.
- `src/lib/constants.ts` provides an existing department vocabulary that should be reused to avoid drift between browse/add-entry flows and assistant facets.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Story 1.4a acceptance criteria
  - Epic 1 overview
  - Story 1.5 and Story 1.6 sequencing boundaries
  - UX design requirements for filters, result rows, and Phase 1 entry cards
- `_bmad-output/planning-artifacts/prd.md`
  - FR4, FR10, FR12
  - mobile and accessibility expectations for filters and evidence flows
  - later-phase scoping notes for richer filters and mixed-media retrieval
- `_bmad-output/planning-artifacts/architecture.md`
  - Core architectural decisions
  - Retrieval & Answering Architecture
  - Frontend Architecture
  - Brownfield guardrails and project structure boundaries
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Search-Result Style Response
  - Filters, Facets, And Search Controls
  - Source Card Anatomy
  - Permission-Safe Display Rules
  - Empty, Loading, Error, And No-Answer States
- `_bmad-output/project-context.md`
  - Technology Stack & Versions
- `_bmad-output/implementation-artifacts/1-4-add-hybrid-search-and-intent-routing-for-entry-queries.md`
  - Story boundaries
  - Current code intelligence
  - Previous story learnings
- `_bmad-output/implementation-artifacts/1-3-deliver-permission-safe-entry-search.md`
  - ACL and source-action guardrails
  - permission-safe preview/open patterns
- `src/lib/constants.ts`
  - existing department vocabulary
- `server/config.ts`
  - assistant query-result limit defaults
- `server/rag/types.ts`
  - current placeholder filter model
- `server/rag/schemas.ts`
  - current query request validation
- `server/rag/service.ts`
  - current result payload shaping and follow-up suggestions
- `server/rag/db.ts`
  - current ACL-safe hybrid retrieval and metadata filtering
- `src/features/assistant/components/AssistantPage.tsx`
  - current filter drawer/sheet seams and session behavior
- `src/features/assistant/components/AssistantContextPanel.tsx`
  - placeholder filter panel seam
- `src/features/assistant/components/AssistantTranscript.tsx`
  - current result rendering without summary row or show-more logic
- `src/test/assistant/AssistantPage.test.tsx`
  - current assistant UI regression coverage
- https://tanstack.com/query/latest/docs/framework/react/reference/useMutation
- https://github.com/pgvector/pgvector/blob/master/README.md
- https://www.postgresql.org/docs/current/textsearch-indexes.html

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Replace the placeholder assistant filter contract with normalized Phase 1 filters (`department`, inclusive `date_range`, `sort`) shared across backend and frontend types.
- Enforce those filters and per-turn snapshots inside the existing ACL-safe `searchEntryKnowledge(...)` retrieval path while keeping the current hybrid relevance flow and adding deterministic `newest` ordering.
- Turn the assistant filter rail/sheet seam into working controls, active chips, `Clear all`, per-turn summaries, and five-result reveal behavior without pulling later-story answer or citation UX forward.
- Extend assistant UI regression coverage and backend integration coverage, then validate with lint/build plus any runnable automated tests in the current environment.

### Debug Log References

- Story creation workflow: `bmad-create-story`
- Sprint status auto-discovery selected `1-4a-add-filtered-entry-result-lists-and-phase-1-facets`
- Previous story context reviewed from:
  - `_bmad-output/implementation-artifacts/1-4-add-hybrid-search-and-intent-routing-for-entry-queries.md`
  - `_bmad-output/implementation-artifacts/1-3-deliver-permission-safe-entry-search.md`
- Current implementation seams reviewed from:
  - `server/config.ts`
  - `server/rag/types.ts`
  - `server/rag/schemas.ts`
  - `server/rag/service.ts`
  - `server/rag/db.ts`
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantContextPanel.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/features/assistant/types.ts`
  - `src/test/assistant/AssistantPage.test.tsx`
- Latest tech check sources:
  - TanStack Query React reference
  - pgvector README
  - PostgreSQL current text-search docs
- Validation commands run:
  - `npm run test:client -- src/test/assistant/AssistantPage.test.tsx`
  - `npm run lint`
  - `npm run build:server`
  - `npm run build`
  - `TEST_DATABASE_URL=postgres://nerve:nerve@127.0.0.1:5432/nerve_test npm run test:server -- server/test/rag/rag.integration.test.ts`
- Validation blockers:
  - Local server RAG integration tests remain blocked in this environment because the temporary PostgreSQL container path was not reachable from the test runtime (`ECONNREFUSED 127.0.0.1:5432`) even after starting Docker-managed Postgres for verification.

### Completion Notes List

- Implemented the Phase 1 assistant filter contract across backend and frontend with `department`, inclusive `date_range`, and `sort` (`relevance` / `newest`) while preserving explicit assistant payload wrappers and feature-local state.
- Extended the ACL-safe retrieval path so department/date filters and deterministic `newest` ordering are applied server-side, and added `applied_filters` plus `total_results` to each assistant response for transcript-safe summaries.
- Replaced the placeholder filter panel with working desktop/mobile controls, active removable chips, `Clear all`, session-scoped filter persistence, per-turn summary rows, and `Show more results` expansion without changing the assistant shell or preview/open source boundaries.
- Added assistant UI regression coverage for filtered submissions, per-turn facet snapshots, session persistence across `New conversation`, and five-result reveal behavior.
- Added backend integration coverage for department filtering, inclusive date filtering, and safe malformed-date handling, but full execution of the server RAG integration suite is still blocked by the current environment's PostgreSQL connectivity path.
- Increased the default `ASSISTANT_QUERY_RESULT_LIMIT` from `5` to `20` across server config, compose defaults, and env examples, and updated API/developer docs to match the shipped Phase 1 behavior.

### File List

- `.env.example`
- `.env.local.example`
- `_bmad-output/implementation-artifacts/1-4a-add-filtered-entry-result-lists-and-phase-1-facets.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/api-contracts-api-server.md`
- `docs/development-guide-api-server.md`
- `docker-compose.yml`
- `server/config.ts`
- `server/rag/db.ts`
- `server/rag/schemas.ts`
- `server/rag/service.ts`
- `server/rag/types.ts`
- `server/test/rag/rag.integration.test.ts`
- `server/test/rag/test-utils.ts`
- `src/features/assistant/components/AssistantContextPanel.tsx`
- `src/features/assistant/components/AssistantFiltersPanel.tsx`
- `src/features/assistant/components/AssistantPage.tsx`
- `src/features/assistant/components/AssistantTranscript.tsx`
- `src/features/assistant/filters.ts`
- `src/features/assistant/types.ts`
- `src/test/assistant/AssistantPage.test.tsx`

### Change Log

- 2026-04-06: Created Story 1.4a with filter/facet, summary-row, and show-more guardrails; advanced sprint status to `ready-for-dev`.
- 2026-04-06: Implemented Phase 1 assistant filters, per-turn result summaries, and show-more behavior; validation remains in-progress because the server RAG integration suite could not reach a runnable PostgreSQL endpoint in this environment.
