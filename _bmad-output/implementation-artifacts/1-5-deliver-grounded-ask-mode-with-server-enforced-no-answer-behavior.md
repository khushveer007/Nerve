# Story 1.5: Deliver Grounded Ask Mode with Server-Enforced No-Answer Behavior

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Nerve user,
I want answer-style responses that only use supported entry evidence,
so that I can trust the assistant when it summarizes or explains knowledge.

**FRs implemented:** FR2, FR6, FR14, FR15, FR17, FR18

## Acceptance Criteria

1. Given a user submits a synthesis-oriented question in `Ask` mode or `Auto` mode, when the evidence threshold is met, then the assistant returns a concise grounded answer, and every substantive claim cluster includes at least one inline citation.
2. Given the available accessible evidence is weak, conflicting, or insufficient, when the request is evaluated on the server, then the system returns a no-answer or search-style fallback response, and the model is not asked to generate a confident unsupported narrative.
3. Given an answer response is returned, when the client renders it, then the payload includes explicit `grounded` and `enough_evidence` state, and helpful follow-up suggestions are available for the user.
4. Given curated no-answer evaluation queries are run, when Phase 1 quality is assessed, then at least 90% of those queries correctly abstain, and unsupported narrative answers are treated as launch-blocking defects.

## Tasks / Subtasks

- [ ] Add a server-owned evidence sufficiency and grounded-answer pipeline for `Ask` turns without weakening the current ACL-safe retrieval path. (AC: 1, 2, 4)
  - [ ] Add dedicated answer-generation helpers under `server/rag/*` so `executeAssistantQuery(...)` does not grow into a monolith. A focused split such as `server/rag/answering.ts` plus a prompt/helper module is preferred.
  - [ ] Reuse the existing hybrid retrieval path from Stories 1.3, 1.4, and 1.4a so answer generation starts from ACL-safe, entry-only, filter-aware results instead of a second retrieval implementation.
  - [ ] Select only authorized evidence chunks/results for synthesis, preserve citation locators, and keep the evidence set machine-usable for later Story 1.6 inspection work.
  - [ ] Make the sufficiency decision deterministic and server-enforced before narrative generation. Weak, conflicting, or insufficient evidence must return no-answer or search-style fallback without calling the answer model.
  - [ ] Use the PRD-fixed Azure AI Foundry answer direction for grounded synthesis with `gpt-4.1-mini`; do not introduce a separate conversational model path that can bypass the evidence gate.

- [ ] Replace the current placeholder answer/citation contract with an explicit grounded-answer response shape that still matches existing API conventions. (AC: 1, 2, 3)
  - [ ] Extend `server/rag/types.ts`, `server/rag/schemas.ts`, `server/rag/service.ts`, `src/features/assistant/types.ts`, and any touched API mappers so `answer`, `grounded`, `enough_evidence`, `citations`, `follow_up_suggestions`, and supporting results work for answer, fallback, and abstention turns.
  - [ ] Replace the current `service.ts` behavior that always returns `answer: null`, `grounded: false`, and top-result placeholder citations. Returned citations must support the actual grounded answer, not just the first three search cards.
  - [ ] Keep named payload wrappers (`{ result }`) and `{ message }` errors. Preserve `request_id` and the normalized `applied_filters` snapshot for each submitted turn.
  - [ ] If supporting results are returned alongside an answer, keep them clearly subordinate to the answer-first layout and limited to authorized Phase 1 entry sources.

- [ ] Render answer-first, no-evidence, and low-confidence UX in the assistant without pulling full citation inspection forward. (AC: 1, 2, 3)
  - [ ] Update `src/features/assistant/components/AssistantPage.tsx` and `src/features/assistant/components/AssistantTranscript.tsx` so `Ask` and routed-`ask` turns can show a concise grounded answer card, inline citation chips, and a supporting evidence/source block under the answer.
  - [ ] Replace the current search-first-only summary copy for `Ask` turns with explicit grounded-answer, no-evidence, or fallback language that matches the UX specification.
  - [ ] Distinguish zero-result, no-evidence, and low-confidence outcomes in user-facing copy. Neutral abstention copy such as `in the sources available to you` should remain the standard phrasing.
  - [ ] Preserve the existing desktop/mobile shell, filter persistence, result-card actions, and `New conversation` behavior. Story 1.5 should extend the current surface, not redesign it.
  - [ ] Add descriptive accessible names for citation chips and keep keyboard-safe rendering in place even though citation-click inspection and evidence-rail interaction are reserved for Story 1.6.

- [ ] Preserve boundaries with adjacent Epic 1 work so grounded answers do not blur into later stories. (AC: 1, 2, 3, 4)
  - [ ] Do not implement citation-click evidence rail selection, evidence-sheet navigation, or preview synchronization behavior from Story 1.6.
  - [ ] Do not pull telemetry dashboards, failure classification, or launch-governance workflows forward from Stories 1.7 and 1.8.
  - [ ] Do not add uploads, PDFs, OCR-backed sources, mixed-media citation locators, or download actions from later epics.
  - [ ] Keep Phase 1 answer generation restricted to existing `entries` and the current `/api/assistant/query` route.

- [ ] Add regression, abstention-quality, and contract coverage for grounded answers and no-answer behavior. (AC: 1, 2, 3, 4)
  - [ ] Extend `server/test/rag/rag.integration.test.ts` with cases for sufficient-evidence grounded answers, weak-evidence abstention, conflicting-evidence abstention, routed `auto -> ask` answer behavior, and proof that the model is not invoked when evidence is below threshold.
  - [ ] Add ACL-focused tests proving blocked assets never appear through answer citations, supporting evidence text, fallback results, or follow-up suggestions.
  - [ ] Add or extend schema/contract tests for any new grounded-answer payload fields and no-answer response combinations.
  - [ ] Add assistant UI coverage for answer cards, inline citation chips, supporting evidence/source blocks, no-evidence and low-confidence states, and preserved preview/open actions after answer rendering changes.
  - [ ] Update `docs/api-contracts-api-server.md` and `docs/development-guide-api-server.md` so they describe the grounded-answer contract, abstention behavior, and the current Phase 1 scope accurately.

### Review Findings

- [x] [Review][Patch] Conflict gating only detects numeric disagreements, so contradictory textual sources can still slip through to grounded answer generation [server/rag/answering.ts:226]
- [x] [Review][Patch] Search-mode zero-result responses now return Ask upsell guidance instead of neutral no-results refinement copy [server/rag/service.ts:129]
- [x] [Review][Patch] Auto-mode requests always announce grounded-answer generation while loading, even when the query later resolves to search [src/features/assistant/components/AssistantPage.tsx:159]

## Dev Notes

### Story Intent and Scope Boundaries

- This story is the answer-quality and abstention gate for Epic 1.
- The primary goal is to make `Ask` mode trustworthy by generating narrative answers only from authorized, sufficient entry evidence.
- Story 1.5 must turn the current routed `ask` placeholder into a real grounded answer path, while keeping no-answer behavior server-enforced and explainable.
- This story should introduce inline citations and a supporting evidence/source block in the transcript, but not the interactive citation-inspection workflow reserved for Story 1.6.
- Keep Phase 1 restricted to entry-backed knowledge. Mixed-media answering, uploads, saved threads, and evaluation dashboards remain later work.

### Epic and Cross-Story Context

- Epic 1 delivers a trusted assistant over existing Nerve entries before any mixed-media expansion.
- Story 1.1 established the assistant shell, `/ai/query` route wrapper, and feature-local assistant UI under `src/features/assistant/*`.
- Story 1.2 created the RAG schema, indexing path, and entry-backed assistant query route.
- Story 1.3 made retrieval, preview, and open actions permission-safe and centralized ACL enforcement.
- Story 1.4 added deterministic `auto` routing and ACL-safe hybrid retrieval, but intentionally kept `Ask` turns evidence-led with `answer: null`.
- Story 1.4a added visible Phase 1 filters, per-turn applied-filter snapshots, result summaries, and `Show more results`.
- Story 1.6 adds citation inspection and evidence verification interaction on top of the answer/citation foundation from this story.
- Story 1.7 and Story 1.8 handle telemetry, failure classification, evaluation suites, and launch guardrails after grounded answering is stable.

### Current Code Intelligence

- `server/rag/service.ts` currently resolves mode, optionally generates a query embedding, calls `searchEntryKnowledge(...)`, and always returns `answer: null`, `grounded: false`, and `enough_evidence` based only on `search.totalCount > 0`.
- `server/rag/service.ts` currently creates `citations` from the first three search results even though no answer text exists yet. Story 1.5 must replace those placeholder citations with citations tied to actual grounded claims.
- `server/rag/types.ts` and `src/features/assistant/types.ts` already expose `answer`, `grounded`, `enough_evidence`, `citations`, `follow_up_suggestions`, and `request_id`, which is a good seam for evolving the contract instead of inventing a parallel response shape.
- `server/rag/db.ts` already owns ACL-safe hybrid retrieval, Phase 1 filters (`department`, inclusive `date_range`, `sort`), result counts, and citation locators. Story 1.5 should build on that data instead of bypassing it with direct entry reads.
- `server/rag/routes.ts` already preserves the route -> schema -> service flow for `/api/assistant/query`; keep that call chain intact.
- `src/features/assistant/components/AssistantPage.tsx` still summarizes `Ask` turns as search-style placeholders and treats zero results as the only `no_answer` condition. It does not yet distinguish no-evidence, low-confidence, or grounded-answer outcomes.
- `src/features/assistant/components/AssistantTranscript.tsx` currently renders result-count badges, applied-filter chips, entry cards, and result actions, but it has no answer card, inline citation-chip rendering, or supporting evidence block.
- `src/features/assistant/components/AssistantContextPanel.tsx` is still a reserved evidence surface focused on preview/open actions. Story 1.5 should avoid turning it into the full Story 1.6 citation-inspection rail prematurely.
- `src/features/assistant/types.ts` already has `AssistantStatus = 'no_answer'` and `AssistantLoadingStage = 'checking' | 'retrieving' | 'generating'`, so the UI already has type-level seams for clearer grounded-answer state handling.

### Technical Requirements

- Keep the existing Express session and assistant actor context as the only trust boundary.
- Keep `POST /api/assistant/query` as the single Phase 1 query endpoint. Do not add a second answer-only endpoint unless a local helper boundary truly cannot fit the current route.
- Grounded answers must be generated only from authorized evidence returned through the existing ACL-safe retrieval path.
- The sufficiency gate must run on the server before any answer model invocation. Unsupported answers are launch-blocking defects for this story.
- Use explicit machine-readable evidence metadata and citation locators so Story 1.6 can attach inspection UX without reworking the backend answer pipeline.
- Preserve `mode`, `grounded`, `enough_evidence`, `citations`, `applied_filters`, `total_results`, `results`, `follow_up_suggestions`, and `request_id` in the assistant result contract.
- If the server falls back from answer synthesis, the client must still receive a valid, explainable response shape rather than an exception for weak evidence.
- Keep answer copy concise, accountable, and directly supported by cited entry evidence.
- Do not leak blocked titles, snippets, result counts, citation labels, or evidence text through abstention copy, fallback responses, or supporting evidence blocks.

### Architecture Compliance

- Keep backend assistant work under `server/rag/*`; do not move answer-generation logic into `server/index.ts` or `server/db.ts`.
- Preserve the call chain `route -> zod schema -> service -> retrieval helpers / answer helpers -> db / providers`.
- Reuse the existing hybrid retrieval and ACL helpers instead of adding a second query path just for answer mode.
- Keep `src/pages/AIQuery.tsx` as the thin route wrapper and continue housing assistant behavior in `src/features/assistant/*`.
- Do not move assistant request/results state into `useAppData()` or `/api/bootstrap`.
- Preserve Phase 1 entry-only source cards, preview/open actions, and the current desktop/mobile sheet and drawer patterns.

### Library and Framework Requirements

- **TanStack React Query 5:** Keep assistant query execution in feature-scoped mutation hooks. Current TanStack Query docs still document `useMutation` with `mutateAsync`, `reset`, and `isPending`, which matches the existing request-scoped assistant workflow and does not justify a state-management rewrite for this story.
- **pgvector:** Current pgvector guidance still warns that filtering can shrink approximate vector results after index scan. Inference for this story: the evidence-sufficiency gate must not treat vector-ranked candidates as authoritative without the existing ACL/filter-aware retrieval pipeline and explicit relevance thresholds.
- **PostgreSQL full-text search:** Current PostgreSQL docs continue to position GIN-backed `tsvector` search as the standard lexical foundation. Keep the current FTS leg of hybrid retrieval in place while adding answer synthesis and abstention on top.
- **Azure AI Foundry answer model direction:** The PRD and architecture fix the Phase 1 answer path around `gpt-4.1-mini` for grounded generation. Use that model direction for narrative answer synthesis, and keep the model prompt constrained to selected evidence only.

### File Structure Requirements

- Update these backend files:
  - `server/config.ts`
  - `server/rag/routes.ts`
  - `server/rag/service.ts`
  - `server/rag/db.ts`
  - `server/rag/types.ts`
  - `server/rag/schemas.ts`
  - `server/test/rag/rag.integration.test.ts`
  - `server/test/rag/rag.schemas.test.ts`
  - `docs/api-contracts-api-server.md`
  - `docs/development-guide-api-server.md`
- Add focused backend helpers if they keep answer generation readable and testable:
  - `server/rag/answering.ts`
  - `server/rag/prompts.ts`
  - `server/rag/providers/*` only if the answer-provider wiring needs a clean boundary that matches existing config patterns
- Update these frontend files:
  - `src/features/assistant/api.ts`
  - `src/features/assistant/types.ts`
  - `src/features/assistant/hooks/useAssistantQuery.ts`
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/features/assistant/components/AssistantContextPanel.tsx` only if a minimal evidence/supporting-source enhancement is needed without stealing Story 1.6 scope
  - `src/features/assistant/constants.ts` if starter prompts or trust-copy need to reflect live grounded-answer behavior
  - `src/test/assistant/AssistantPage.test.tsx`
- Reuse rather than replace:
  - `src/pages/AIQuery.tsx`
  - `src/features/assistant/components/AssistantHeader.tsx`
  - `src/features/assistant/components/AssistantComposer.tsx`
  - `src/features/assistant/filters.ts`
  - the existing preview/open-source path and ACL boundary from Story 1.3

### Testing Requirements

- Add server integration coverage for:
  - sufficient-evidence `Ask` responses returning a grounded answer
  - routed `auto -> ask` responses returning grounded answers when evidence is sufficient
  - weak-evidence abstention with no narrative answer
  - conflicting-evidence abstention or search-style fallback
  - proof that the answer model is not called when evidence is insufficient
  - citation coverage for every substantive grounded-answer claim cluster
  - ACL-safe citation and evidence behavior so blocked assets never surface through answer text, citations, snippets, or fallback source groups
- Add schema/contract coverage for:
  - grounded-answer payloads with citations
  - no-answer payloads with `grounded = false` and `enough_evidence = false`
  - any new answer-provider validation or request-shape rules
- Add assistant UI coverage for:
  - grounded answer card rendering
  - inline citation-chip rendering and accessible labels
  - supporting evidence/source block rendering under the answer
  - no-evidence and low-confidence state cards with follow-up suggestions
  - preserved result-card preview/open actions after answer-mode rendering changes
- Recommended verification commands for the implementation agent:
  - `npm run lint`
  - `npm test`
  - `npm run build:server`
  - `npm run build`

### Previous Story Intelligence

- Story 1.4 deliberately routed answer-oriented turns to `ask` without generating prose yet. Story 1.5 should preserve that explainable routing seam and replace only the placeholder answer behavior.
- Story 1.4a already landed the Phase 1 filter contract, per-turn applied-filter snapshots, result summaries, and `Show more results`. This story must build from that current state rather than reintroducing the older placeholder filter arrays.
- Story 1.4a also raised `ASSISTANT_QUERY_RESULT_LIMIT` to `20`, which means answer-mode supporting results can reveal more than the initial five cards without faking pagination.
- Story 1.3 centralized ACL checks and source preview/open flows. Grounded answers and citations must use the same trust boundary instead of inventing a second access decision path.
- Story 1.3 and Story 1.4 both kept assistant state feature-local and request-scoped. Any answer-generation loading or abstention UI should continue following that pattern.

### Git Intelligence Summary

- The latest relevant commit is `cf08138` (`feat: Implement Phase 1 filters for assistant queries with department, date range, and sorting options`), which confirms the repo already contains the real Phase 1 facet contract, summary rows, and show-more behavior that Story 1.5 must extend.
- The prior assistant retrieval commit `08d9e22` (`feat: Implement hybrid search and intent routing enhancements with embedding timeout and distance configurations`) established the routed `ask` seam and the hybrid retrieval pipeline that grounded answering should now build on.
- The recent history shows the assistant work continues to land in `server/rag/*`, `src/features/assistant/*`, docs, and server/client tests together. Keep following that file pattern for Story 1.5.

### Latest Tech Information

- As of 2026-04-07, TanStack Query's current React docs still document `useMutation` around `mutateAsync`, `reset`, and `isPending`, which aligns with the current assistant mutation workflow and supports answer/no-answer state changes without a client-state architecture rewrite.
- As of 2026-04-07, PostgreSQL's current text-search docs still position GIN as the preferred general-purpose index type for `tsvector` search. Inference: keep the existing lexical leg of hybrid retrieval rather than replacing it with answer-model heuristics.
- As of 2026-04-07, pgvector guidance still warns that ANN filtering can under-return when post-scan filters discard candidates. Inference: the sufficiency gate should rely on the existing ACL-safe hybrid retrieval design plus explicit thresholds, not on vector proximity alone.

### Project Structure Notes

- The repo already has the correct brownfield seams for this story:
  - backend assistant logic under `server/rag/*`
  - UI behavior under `src/features/assistant/*`
  - thin route wrapper under `src/pages/AIQuery.tsx`
- The largest implementation risk is mixing three concerns into one change:
  - grounded answer generation
  - citation-interaction UX
  - later-phase telemetry/evaluation infrastructure
  Keep Story 1.5 focused on the first concern and only the minimum transcript/UI changes needed to surface trustworthy answers and abstentions.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Story 1.5 acceptance criteria
  - Story 1.6, 1.7, and 1.8 sequencing boundaries
  - Epic 1 scope and FR mapping
- `_bmad-output/planning-artifacts/prd.md`
  - FR2, FR6, FR14, FR15, FR17, FR18
  - MVP grounded-answer and abstention requirements
  - launch-quality answer and no-answer expectations
- `_bmad-output/planning-artifacts/architecture.md`
  - Query contract
  - No-answer policy
  - Retrieval & Answering Architecture
  - frontend and brownfield structure rules
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Auto Mode Rules
  - Grounded Answer Flow
  - No-Evidence / Low-Confidence Flow
  - citation accessibility requirements
- `_bmad-output/project-context.md`
  - Technology Stack & Versions
- `_bmad-output/implementation-artifacts/1-4-add-hybrid-search-and-intent-routing-for-entry-queries.md`
  - routed `ask` placeholder behavior
  - hybrid retrieval seams
  - prior story learnings
- `_bmad-output/implementation-artifacts/1-4a-add-filtered-entry-result-lists-and-phase-1-facets.md`
  - current Phase 1 filter contract
  - summary-row and result-expansion behavior
  - updated code intelligence after the facet story landed
- `_bmad-output/implementation-artifacts/1-3-deliver-permission-safe-entry-search.md`
  - ACL guardrails
  - permission-safe preview/open patterns
- `server/rag/service.ts`
  - current `answer: null` placeholder behavior
  - placeholder citation assembly
- `server/rag/types.ts`
  - current assistant result contract and citation locator types
- `server/rag/db.ts`
  - ACL-safe hybrid retrieval and citation-locator source data
- `src/features/assistant/components/AssistantPage.tsx`
  - current state transitions and `Ask` summary behavior
- `src/features/assistant/components/AssistantTranscript.tsx`
  - current search-first transcript rendering
- `src/features/assistant/components/AssistantContextPanel.tsx`
  - current evidence-preview placeholder surface

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-04-07T01:36:50+05:30 - `npm run test:server -- server/test/rag/rag.schemas.test.ts server/test/rag/rag.integration.test.ts` (schema tests failed before backend contract existed; integration tests blocked in this shell because `DATABASE_URL` / `TEST_DATABASE_URL` is not configured).
- 2026-04-07T01:36:50+05:30 - `npm run test:client -- src/test/assistant/AssistantPage.test.tsx` (red phase to capture missing grounded-answer and abstention UI).
- 2026-04-07T01:43:10+05:30 - `npm run test:server -- server/test/rag/rag.schemas.test.ts` (passed after contract/schema implementation).
- 2026-04-07T01:43:19+05:30 - `npm run build:server` (passed after backend answer pipeline wiring).
- 2026-04-07T01:42:59+05:30 - `npm run test:client -- src/test/assistant/AssistantPage.test.tsx` (passed after transcript/UI updates).
- 2026-04-07T01:44:40+05:30 - `npm run build` (passed; Vite emitted the existing large-chunk warning only).
- 2026-04-07T01:43:10+05:30 - `npm run lint` (passed with the repo's pre-existing React Fast Refresh warnings in shared UI/hook files).

### Completion Notes List

- Implemented a server-owned Ask-mode pipeline in `server/rag/service.ts` + new `server/rag/answering.ts` / `server/rag/prompts.ts` that reuses ACL-safe retrieval, performs deterministic evidence sufficiency checks, detects simple numeric conflicts, and only calls the configured answer endpoint after the gate passes.
- Replaced placeholder Ask-mode contract behavior so grounded answers can return real `answer`, `grounded`, `enough_evidence`, `citations`, `follow_up_suggestions`, `results`, `applied_filters`, and `request_id` data through the existing `{ result }` API wrapper.
- Added response-schema coverage and answer-provider test scaffolding in `server/rag/schemas.ts`, `server/test/rag/rag.schemas.test.ts`, and `server/test/rag/test-utils.ts`; expanded `server/test/rag/rag.integration.test.ts` with grounded-answer, abstention, conflict, and ACL-focused cases for an environment that has test database access.
- Updated the assistant transcript/UI to render grounded answer cards, inline citation chips, supporting source sections, routed auto-to-ask messaging, and low-confidence / no-evidence states while preserving preview/open actions and current layout behavior.
- Updated `.env.example`, `docs/api-contracts-api-server.md`, and `docs/development-guide-api-server.md` for the new answer-provider configuration and grounded/no-answer contract.
- Validation is partially complete, not complete: focused client tests, response-schema tests, `npm run build`, `npm run build:server`, and `npm run lint` all passed, but the full server integration suite could not run in this shell because `DATABASE_URL` / `TEST_DATABASE_URL` is unavailable. Story status remains `in-progress` until that gate is run successfully.

### File List

- `.env.example`
- `_bmad-output/implementation-artifacts/1-5-deliver-grounded-ask-mode-with-server-enforced-no-answer-behavior.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/api-contracts-api-server.md`
- `docs/development-guide-api-server.md`
- `server/config.ts`
- `server/rag/answering.ts`
- `server/rag/prompts.ts`
- `server/rag/routes.ts`
- `server/rag/schemas.ts`
- `server/rag/service.ts`
- `server/rag/types.ts`
- `server/test/rag/rag.integration.test.ts`
- `server/test/rag/rag.schemas.test.ts`
- `server/test/rag/test-utils.ts`
- `src/features/assistant/components/AssistantPage.tsx`
- `src/features/assistant/components/AssistantTranscript.tsx`
- `src/features/assistant/constants.ts`
- `src/test/assistant/AssistantPage.test.tsx`

### Change Log

- 2026-04-07 - Implemented grounded Ask-mode backend/UI flow, added abstention/fallback contract handling, updated docs/env examples, and left the story in `in-progress` pending database-backed integration validation.
