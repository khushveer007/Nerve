# Story 1.6: Add Citation Inspection and Entry Evidence Verification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Nerve user,
I want to inspect citations and open the supporting entry evidence,
so that I can verify what the assistant is claiming without leaving the trust boundary.

**FRs implemented:** FR13, FR15, FR16

## Acceptance Criteria

1. Given an answer includes citations, when the user clicks or focuses a citation chip, then the assistant opens the evidence rail with the selected citation highlighted, and the rail shows the related snippet, source metadata, and available source actions.
2. Given the user navigates citations with keyboard only, when citation chips and evidence items receive focus, then focus order remains clear and visible, and citation controls expose descriptive accessible names for screen readers.
3. Given citation chips or evidence actions are rendered on touch-capable devices, when the user interacts with them, then the controls provide a minimum 44 by 44 interaction target, and touch affordances do not remove visible focus treatment for keyboard users.
4. Given the cited source is an entry, when the user chooses `Preview` or `Open source`, then the assistant shows the relevant entry excerpt or opens the authenticated entry detail flow, and the evidence remains linked to the originating citation.
5. Given the system is rendering evidence and citation states, when trust-critical information is displayed, then status is not conveyed by color alone, and no blocked citation or snippet is shown.

## Tasks / Subtasks

- [x] Make citations action-ready across the server and client contracts without creating a second trust path. (AC: 1, 4, 5)
  - [x] Extend `server/rag/types.ts`, `server/rag/schemas.ts`, `src/features/assistant/types.ts`, and any touched API mappers so every rendered citation has enough action-safe metadata to preview or open the cited entry directly from the citation path. Reuse the existing assistant source-reference shape and ACL-safe open/preview flow instead of inventing a citation-only endpoint.
  - [x] Keep `/api/assistant/query`, `/api/assistant/source-preview`, and `/api/assistant/source-open` as the only Phase 1 assistant evidence boundaries. Story 1.6 may enrich the citation payload, but it must not bypass the current authorization checks in `server/rag/service.ts` and `server/rag/db.ts`.
  - [x] Preserve machine-usable `citation_locator` data and Phase 1 `entry` source-kind constraints so the evidence rail can link a citation to its supporting chunk without adding PDF, OCR, download, or mixed-media behavior from later stories.
  - [x] Ensure blocked sources remain absent from citation chips, evidence snippets, preview payloads, source-open targets, and any cited-source counts or labels.

- [x] Wire citation-selection state into the assistant workspace so citation clicks and focus events drive the evidence rail. (AC: 1, 2, 4)
  - [x] Update `src/features/assistant/components/AssistantPage.tsx` to track the active citation, active cited source, and the turn that owns the current evidence state instead of using the context panel only for result-card previews.
  - [x] Open the desktop evidence rail or mobile drawer/sheet from citation interaction without changing the `/ai/query` route or breaking the existing `New conversation` reset behavior.
  - [x] Keep stale async preview responses from older turns/conversations from overwriting the newly selected citation state, using the same request-scoping discipline already present for preview/open actions.
  - [x] Preserve the visible link between the originating citation chip and the selected evidence panel item after preview/open actions complete.

- [x] Turn grounded-answer citation chips into fully interactive, keyboard-safe controls. (AC: 1, 2, 3, 5)
  - [x] Replace passive citation badges in `src/features/assistant/components/AssistantTranscript.tsx` with interactive controls that call back into the page-level citation-selection handler.
  - [x] Give each citation control a descriptive accessible name that includes the citation label plus the best available entry title and locator context (`page`, `heading_path`, or equivalent entry location data). Follow the UX guidance that citation chips are inline controls, not footer-only metadata.
  - [x] Keep visible focus styles, deterministic tab order, and keyboard activation behavior for `Enter` and `Space`.
  - [x] Ensure citation chips and evidence actions meet the 44x44 minimum hit target on touch-capable layouts without removing visible focus treatment for keyboard users.
  - [x] Do not rely on color alone to show the active citation, grounded/trust status, or evidence selection; pair color with text, badges, outlines, or iconography.

- [x] Upgrade the evidence rail and mobile evidence surface from generic preview space into citation-driven verification UI. (AC: 1, 3, 4, 5)
  - [x] Update `src/features/assistant/components/AssistantContextPanel.tsx` so the evidence section can render the selected citation preview, cited-source list, locator details, source metadata, and action buttons for the active citation.
  - [x] Keep `Preview` as the in-context verification action and `Open source` as the authenticated navigation action. Do not add `Download` or later-phase asset-state UI in this story.
  - [x] Show the cited snippet and locator information in a way that makes the support traceable to the active citation, even after the user previews or opens the source.
  - [x] On mobile/tablet, preserve the existing sheet/drawer model from the assistant shell so evidence inspection stays usable without layout breakage.

- [x] Add regression coverage and documentation for citation inspection behavior. (AC: 1, 2, 3, 4, 5)
  - [x] Extend `src/test/assistant/AssistantPage.test.tsx` with coverage for citation-click evidence opening, keyboard focus/activation, selected-citation persistence, mobile evidence-drawer behavior, and permission-safe preview/open actions initiated from citation-driven UI.
  - [x] Add or extend contract/schema coverage in `server/test/rag/rag.schemas.test.ts` and `server/test/rag/rag.integration.test.ts` for any enriched citation payload fields and ACL-safe evidence behavior.
  - [x] Keep or add regression tests proving blocked citations/snippets never surface through grounded answers, evidence-rail content, preview requests, or source-open actions.
  - [x] Update `docs/api-contracts-api-server.md` and `docs/development-guide-api-server.md` so the documented assistant contract and evidence flow match the live citation-inspection behavior.

## Dev Agent Record

### Implementation Plan

- Enrich grounded citation payloads with the existing assistant-safe source reference and action availability so citations can reuse the preview/open trust boundary.
- Replace passive citation badges with interactive controls that drive a single page-level evidence selection model.
- Upgrade the evidence rail/drawer into citation-driven verification UI, then extend assistant tests, schema tests, and docs to match.

### Debug Log

- 2026-04-07: Implemented shared citation/evidence helpers and updated server/client citation contracts to carry `source` plus action availability.
- 2026-04-07: Refactored assistant evidence selection so citation focus/click drives the desktop rail or mobile drawer without route changes and stale preview responses are scoped away.
- 2026-04-07: Reworked transcript citation chips and context panel evidence rendering, then updated assistant UI tests, schema tests, docs, lint, and build validation.

### Completion Notes

- Citation chips are now interactive, keyboard-focusable controls with descriptive accessible names, visible selected state, and 44x44 minimum touch targets.
- The assistant workspace now tracks citation-driven evidence state per turn and keeps the selected citation linked to preview/open actions across desktop and mobile evidence surfaces.
- Grounded citation payloads now reuse the assistant `source` reference and action availability, so citation inspection stays on `/api/assistant/query`, `/api/assistant/source-preview`, and `/api/assistant/source-open` only.
- Validation completed: `npm run test:client -- src/test/assistant/AssistantPage.test.tsx`, `npm run test:server -- server/test/rag/rag.schemas.test.ts`, `npm run lint`, and `npm run build`.
- Validation gap: DB-backed `server/test/rag/rag.integration.test.ts` could not run in this workspace because `DATABASE_URL` / `TEST_DATABASE_URL` is not configured and `127.0.0.1:5432` is unavailable. Story status remains `in-progress` until that environment-specific verification is rerun.

## File List

- server/rag/answering.ts
- server/rag/schemas.ts
- server/rag/types.ts
- server/test/rag/rag.integration.test.ts
- server/test/rag/rag.schemas.test.ts
- src/features/assistant/components/AssistantContextPanel.tsx
- src/features/assistant/components/AssistantPage.tsx
- src/features/assistant/components/AssistantTranscript.tsx
- src/features/assistant/evidence.ts
- src/features/assistant/types.ts
- src/test/assistant/AssistantPage.test.tsx
- docs/api-contracts-api-server.md
- docs/development-guide-api-server.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-04-07: Added citation-driven evidence inspection across grounded assistant answers, upgraded the evidence rail/mobile drawer UI, enriched citation contracts, and extended assistant/schema regression coverage.

## Dev Notes

### Story Intent and Scope Boundaries

- Story 1.6 is the verification layer on top of the grounded-answer foundation delivered in Story 1.5.
- The core goal is to make inline citations actionable so users can inspect supporting entry evidence inside the assistant, not just read citation labels.
- This story should convert the existing context panel from result-preview-only behavior into citation-driven evidence verification while preserving the same permission-safe trust boundary.
- Keep Phase 1 restricted to entry-backed sources. Do not add PDFs, page-jump document viewers, OCR-backed preview patterns, downloads, persisted threads, telemetry, or evaluation workflows from later stories.
- Keep the current assistant route, transcript model, and request-scoped state architecture. This is an interaction upgrade, not a page redesign.

### Epic and Cross-Story Context

- Epic 1 replaces the legacy AIQuery fallback with a trusted assistant over existing Nerve entries.
- Story 1.3 centralized ACL-safe retrieval and source preview/open behavior; Story 1.6 must reuse that trust boundary rather than introducing a parallel evidence flow.
- Story 1.4 and Story 1.4a established deterministic mode routing, hybrid retrieval, active filters, summary rows, and result expansion behavior that must stay intact while citation inspection is added.
- Story 1.5 delivered grounded answers, inline citation labels, supporting-source blocks, and no-answer behavior, but intentionally stopped short of citation-click inspection and evidence-rail synchronization.
- Story 1.7 and Story 1.8 remain out of scope. Do not pull telemetry, failure classification, evaluation dashboards, or launch-governance work forward.

### Current Code Intelligence

- `src/features/assistant/components/AssistantTranscript.tsx` already parses grounded answer blocks and renders citation labels through `renderCitationBadge(...)`, but those chips are passive badges with no selection or preview behavior.
- `src/features/assistant/components/AssistantPage.tsx` already owns `evidenceOpen`, `selectedPreview`, and preview/open request scoping, but that state is driven by result-card actions rather than citation selection.
- `src/features/assistant/components/AssistantContextPanel.tsx` currently describes citations as future behavior and mainly renders result-card preview content. Story 1.6 should evolve this surface into the actual evidence rail/mobile sheet defined in the UX spec.
- `server/rag/service.ts` already exposes ACL-safe `getAssistantSourcePreview(...)` and `getAssistantSourceOpen(...)` helpers plus grounded-answer results from `executeAssistantQuery(...)`. Reuse those helpers instead of adding duplicate preview/open logic in the client.
- `server/rag/types.ts` and `src/features/assistant/types.ts` currently give citations `label`, `asset_id`, `title`, `snippet`, and `citation_locator`, but they do not yet expose the full action-ready source reference that the existing preview/open flows require (`entry_id` is only present on results/source references). The implementation should close that gap cleanly.
- `src/test/assistant/AssistantPage.test.tsx` already covers grounded answers, result-card previews, stale preview protection, and auto-to-ask messaging. Story 1.6 should extend those tests rather than rewriting the assistant test harness.

### Technical Requirements

- Citation interaction must remain permission-safe end to end. If a source is not authorized, the user must not see the chip, snippet, source title, open target, or a disabled placeholder implying hidden content.
- The evidence rail must open from citation interaction without route changes and must preserve the relation between the clicked citation and the selected evidence content.
- Keep `Preview` and `Open source` behavior aligned with the existing authenticated entry-source flow. Preview stays in the assistant context; open navigates to the existing internal entry detail target.
- The UI must clearly distinguish active citation selection, grounded/trust state, and low-confidence/no-answer states without using color as the only signal.
- Use the existing answer contract as the foundation. If citation payload enrichment is needed, keep the result envelope named as `{ result }` and preserve current `request_id`, `applied_filters`, `results`, and `follow_up_suggestions` behavior.
- Maintain the current stale-request protection pattern for preview/open actions so a response from an older citation interaction cannot overwrite a newer evidence selection.
- Keep answer text concise and claim-linked. The evidence rail should carry the deeper verification burden instead of expanding answer prose.

### Architecture Compliance

- Keep backend assistant logic under `server/rag/*`; do not move assistant evidence behavior into unrelated server modules.
- Preserve the call chain `route -> zod schema -> service -> db / preview helpers` for query, preview, and source-open behavior.
- Keep the assistant feature-local on the client under `src/features/assistant/*`; do not push citation/evidence state into `useAppData()` or `/api/bootstrap`.
- Preserve the thin route wrapper at `src/pages/AIQuery.tsx` and keep the evidence experience inside the current assistant feature implementation.
- Follow the architecture rule that citation clicks open the evidence rail/mobile sheet without route changes.

### Library and Framework Requirements

- **React 18.3.1 / Vite 5 / TypeScript 5.8:** Keep the story within the existing feature-local React component model and typed assistant contracts already used across `src/features/assistant/*`.
- **TanStack React Query 5.83.0:** Continue using the existing query/mutation hooks for preview/open work. The current React Query mutation pattern already fits request-scoped preview/open actions and does not justify a different state-management layer for citation inspection.
- **shadcn/Radix sheet and drawer primitives:** Reuse the existing `Sheet`/`Drawer` patterns already present in `AssistantPage.tsx` for mobile evidence presentation.
- **PostgreSQL 16 + pgvector:** No retrieval-path redesign is needed for this story. Current official guidance still treats GIN-backed text search as the lexical baseline and notes that approximate vector filtering can under-return without careful scan settings; inference for this story: keep citation inspection built on the current ACL-safe hybrid retrieval output instead of inventing a citation-specific retrieval path.

### File Structure Requirements

- Update these frontend files:
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/features/assistant/components/AssistantContextPanel.tsx`
  - `src/features/assistant/types.ts`
  - `src/features/assistant/api.ts` only if citation-initiated preview/open calls need a cleaner client helper boundary
  - `src/features/assistant/hooks/useAssistantQuery.ts` only if citation evidence actions need shared hook support beyond the current result-card flow
  - `src/test/assistant/AssistantPage.test.tsx`
- Update these backend/doc files if the citation contract is enriched:
  - `server/rag/types.ts`
  - `server/rag/schemas.ts`
  - `server/rag/service.ts`
  - `server/test/rag/rag.schemas.test.ts`
  - `server/test/rag/rag.integration.test.ts`
  - `docs/api-contracts-api-server.md`
  - `docs/development-guide-api-server.md`
- Reuse rather than replace:
  - `src/pages/AIQuery.tsx`
  - `server/rag/routes.ts`
  - `server/rag/db.ts`
  - the existing preview/open source boundary from Story 1.3
  - the current grounded-answer generation path from Story 1.5

### Testing Requirements

- Add assistant UI coverage for:
  - citation chips rendered as interactive controls instead of passive badges
  - citation click/focus opening the evidence rail with the correct citation selected
  - descriptive accessible names on citation controls
  - visible focus and keyboard activation behavior
  - touch-safe action targets for citation chips and evidence actions
  - citation-driven preview/open behavior that keeps the selected evidence linked to the originating citation
  - mobile evidence drawer/sheet behavior without layout regressions
- Add contract/integration coverage for:
  - any enriched citation payload fields needed to preview/open cited entries safely
  - ACL-safe citation rendering and evidence preview behavior
  - proof that blocked sources never appear through citation labels, snippets, preview payloads, or source-open targets
- Recommended verification commands for the implementation agent:
  - `npm run lint`
  - `npm test`
  - `npm run build:server`
  - `npm run build`

### Previous Story Intelligence

- Story 1.5 already landed grounded answers, inline citation labels, supporting sources, and no-answer messaging. Story 1.6 should build directly on those seams instead of reworking answer-generation logic.
- Story 1.5 kept the evidence panel intentionally minimal and reserved citation-click behavior for this story. That means the next implementation should expect to upgrade existing UI rather than add a brand-new verification surface.
- Story 1.5 preserved feature-local assistant state and request scoping. Carry that same discipline forward so citation interactions cannot corrupt newer conversation state with stale preview/open responses.
- Story 1.5 review fixes tightened conflict detection and loading-state messaging. Preserve those fixes while adding citation inspection so answer trust does not regress.

### Git Intelligence Summary

- The latest relevant commit is `f03c2a7` (`feat: enhance assistant query handling with grounded responses and citations`), which confirms the repo already contains grounded answer generation, inline citation rendering, and assistant test coverage that Story 1.6 should extend instead of duplicating.
- The prior commit `cf08138` (`feat: Implement Phase 1 filters for assistant queries with department, date range, and sorting options`) shows the current result-summary, facet, and show-more behavior that citation inspection must preserve.
- Recent assistant work continues to land together across `server/rag/*`, `src/features/assistant/*`, docs, and tests. Keep following that same full-stack change pattern.

### Latest Tech Information

- As of 2026-04-07, TanStack Query’s current React docs still document `useMutation` around request-scoped async workflows (`mutate`, `mutateAsync`, `isPending`, `reset`), which fits the current assistant preview/open pattern and supports citation-driven evidence actions without introducing a new client-state library.
- As of 2026-04-07, PostgreSQL’s current full-text search docs still position GIN indexes as the standard general-purpose index for `tsvector` search. Inference: keep the current lexical leg of hybrid retrieval intact and build citation inspection on the returned evidence instead of adding a second evidence lookup path.
- As of 2026-04-07, pgvector’s current guidance notes that approximate index filtering can under-return results after index scan, and newer iterative scans help recover enough rows when filtering is involved. Inference: citation verification should continue to trust the existing ACL-safe hybrid retrieval pipeline and selected grounded evidence, not a client-triggered vector-only fetch path.

### Project Structure Notes

- The repo already has the right seams for this work:
  - backend assistant contracts and preview/open helpers under `server/rag/*`
  - transcript/page/context UI under `src/features/assistant/*`
  - tests in `src/test/assistant/*` and `server/test/rag/*`
- The biggest implementation risk is splitting citation selection, preview state, and trust rules across too many ad hoc client-only branches. Prefer a single page-level evidence-selection model that both transcript chips and result-card preview actions can use.
- Another likely failure mode is bolting citation interaction onto styling only. This story must treat keyboard order, visible focus, descriptive labels, and touch targets as core acceptance criteria, not polish.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Story 1.6 acceptance criteria
  - Story 1.5, 1.7, and 1.8 sequencing boundaries
  - Epic 1 trusted assistant scope
- `_bmad-output/planning-artifacts/prd.md`
  - FR13, FR15, FR16, FR20, FR21
  - trusted retrieval and evidence-verification requirements
  - accessibility and permission-safety constraints
- `_bmad-output/planning-artifacts/architecture.md`
  - Query contract
  - No-answer policy
  - Retrieval & Answering Architecture
  - Frontend Architecture
  - Architecture rules for evidence rail behavior
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Grounded Answer Flow
  - Citation Inspection Flow
  - Citations And Evidence UX
  - Evidence Rail
  - Source Opening Behavior
  - Permission-Safe Display Rules
- `_bmad-output/project-context.md`
  - Technology Stack & Versions
- `_bmad-output/implementation-artifacts/1-5-deliver-grounded-ask-mode-with-server-enforced-no-answer-behavior.md`
  - grounded-answer contract and previous-story learnings
  - current code intelligence for Story 1.5 seams
  - review findings that must not regress
- `src/features/assistant/components/AssistantPage.tsx`
  - current evidence drawer/sheet state and preview/open request scoping
- `src/features/assistant/components/AssistantTranscript.tsx`
  - passive citation rendering and supporting-source presentation
- `src/features/assistant/components/AssistantContextPanel.tsx`
  - current evidence-panel behavior and preview surface
- `src/features/assistant/types.ts`
  - current citation, result, and source-reference shapes
- `server/rag/service.ts`
  - current query, preview, and open-source helper boundaries
- `server/rag/types.ts`
  - current assistant server contracts
- `server/rag/schemas.ts`
  - current assistant schema validation
- TanStack Query React `useMutation` docs
  - https://tanstack.com/query/latest/docs/framework/react/reference/useMutation
- PostgreSQL 18 documentation, “Preferred Index Types for Text Search”
  - https://www.postgresql.org/docs/current/textsearch-indexes.html
- pgvector README sections on filtering and iterative index scans
  - https://github.com/pgvector/pgvector

### Review Findings

- [x] [Review][Patch] New conversation does not fully reset the mobile evidence surface, so the old drawer can stay open after reset or after a fresh submit and continue showing stale evidence chrome. [src/features/assistant/components/AssistantPage.tsx:256]
- [x] [Review][Patch] Citation chips are still rendered as block-level rows after each paragraph instead of inline answer controls, which breaks the story’s inline-citation interaction requirement and weakens the visible link between claim text and citation trigger. [src/features/assistant/components/AssistantTranscript.tsx:297]
- [x] [Review][Patch] Citation controls still miss the minimum 44x44 touch target for short labels because they only enforce height, not width, so chips like `S1` can render too narrow on touch devices. [src/features/assistant/components/AssistantTranscript.tsx:119]
