# Story 1.1: Replace the Legacy AIQuery Page with the Assistant Workspace

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated Nerve user,
I want a native assistant workspace at `/ai/query`,
so that I can start trusted search and question answering inside the existing app shell.

**FRs implemented:** FR1, FR2, FR3, FR5

## Acceptance Criteria

1. Given an authenticated user opens `/ai/query`, when the page loads, then the user sees the new assistant page inside the existing `AppLayout` and `RoleGuard` flow, and the legacy local-keyword fallback experience is no longer shown.
2. Given the assistant page is opened for the first time in a session, when no query has been submitted yet, then the page shows the `Assistant` title, helper text, `Auto/Search/Ask` mode controls, a sticky composer, and starter prompts, and `Auto` is the default selected mode.
3. Given the updated assistant route is visible in the main application shell, when navigation and page chrome are rendered, then the sidebar label reads `Assistant` while the route remains `/ai/query`, and the page continues to use the existing brownfield navigation structure.
4. Given the assistant enters retrieving, generating, no-answer, or error states, when the visible status changes, then the page announces the change through an `aria-live` region, and screen-reader users receive the same state guidance shown visually.
5. Given a user has already submitted a query in the current assistant session, when they refine, rephrase, or continue that query from the same workspace, then the next turn is appended to the in-page session transcript, and the assistant preserves the current conversation context until the user starts a new conversation.
6. Given the user is on a mobile or tablet viewport, when the assistant page renders, then the layout collapses to a single-column flow with a sticky composer, and filter and evidence affordances are available through sheet or drawer patterns.
7. Given the assistant backend is unavailable, when the user opens `/ai/query`, then the page shows a full-width status card explaining what is unavailable, and it does not fall back to the disconnected local-answer behavior.

## Tasks / Subtasks

- [x] Replace the legacy page with a thin route wrapper and feature module scaffold (AC: 1, 2, 5, 6, 7)
  - [x] Replace `src/pages/AIQuery.tsx` with a thin wrapper that returns the assistant feature page only.
  - [x] Create the initial `src/features/assistant/` structure for page shell, presentational components, constants, and types.
  - [x] Keep assistant-specific state and logic inside the feature module; do not continue using `useAppData()` inside the assistant page.
- [x] Build the Phase 1 workspace shell and empty-state experience (AC: 1, 2, 7)
  - [x] Remove `buildLocalAnswer`, local keyword filtering, copy-last-response behavior, and the disconnected fallback banner from the existing page implementation.
  - [x] Render the page header with title `Assistant`, subtitle `Search and answer across Nerve knowledge with citations.`, and actions for `New conversation` and `Filters`.
  - [x] Render the default `Auto`, `Search`, and `Ask` mode control with `Auto` selected on first load.
  - [x] Show a trust statement plus 4 to 6 starter prompt chips only when the transcript is empty.
  - [x] Show a calm full-width backend-unavailable status card when the real assistant backend is not available, without pretending to answer.
- [x] Implement composer and in-session transcript behavior without fake answering (AC: 2, 5, 7)
  - [x] Use a multiline composer with a 2-line minimum height and 6-line maximum height.
  - [x] Support `Enter` to submit and `Shift+Enter` for newline.
  - [x] Append user turns to an in-page transcript and preserve mode plus conversation context until `New conversation` is invoked.
  - [x] Do not generate local keyword results or synthetic assistant responses as a fallback.
- [x] Implement accessibility and responsive behavior for the new shell (AC: 4, 6, 7)
  - [x] Add a dedicated pre-mounted live region for assistant status announcements and update its text only when the visible state changes.
  - [x] Ensure focus order and keyboard access across mode controls, starter prompts, composer, `Filters`, and `New conversation`.
  - [x] Render a desktop layout that reserves transcript and context areas, while tablet/mobile collapse to a single column with sheet or drawer patterns for filters and evidence affordances.
  - [x] Ensure trust-critical state is not conveyed by color alone and interactive touch targets remain at least 44x44.
- [x] Update existing shell labels from `Ask AI` to `Assistant` while keeping route/auth boundaries intact (AC: 1, 3)
  - [x] Update `src/components/AppSidebar.tsx` labels for `/ai/query`.
  - [x] Update existing content dashboard shortcuts that still render `Ask AI` so the shell naming is consistent.
  - [x] Keep `/ai/query`, `AppLayout`, and `RoleGuard` behavior unchanged in `src/App.tsx`.
- [x] Add regression tests for the shell, accessibility, and no-fake-answer guardrails (AC: 1, 2, 4, 5, 6, 7)
  - [x] Add client tests under `src/test/assistant/*` for default mode, empty state, starter prompts, transcript append/reset behavior, and backend-unavailable status.
  - [x] Add a test that the legacy local-fallback copy and local-answer behavior are no longer rendered.
  - [x] Add a test covering the live-region status announcer and keyboard submission behavior.
  - [x] Add a regression check that the route remains `/ai/query` while user-facing labels show `Assistant`.

### Review Findings

- [x] [Review][Patch] Keep `New conversation` keyboard-accessible on first load [src/features/assistant/components/AssistantHeader.tsx:28]
- [x] [Review][Patch] Do not seed enabled assistant environments as unavailable [src/features/assistant/api.ts:14]

## Dev Notes

### Story Intent and Scope Boundaries

- This story is the UI-shell replacement for `/ai/query`. It establishes the trusted assistant workspace and removes the fake/local keyword experience.
- This story does not deliver real retrieval, indexing, hybrid ranking, filters backed by API query parameters, grounded answers, citations, evidence rendering, or source-open behavior. Those belong to Stories 1.2 through 1.6.
- The story must leave clean extension points for later stories without faking successful assistant behavior in the meantime.
- If the backend is unavailable or not implemented yet, the UI must say so plainly and preserve trust instead of inventing local results.

### Epic and Cross-Story Context

- Epic 1 is the Phase 1 brownfield assistant release over existing `entries` only.
- Story 1.2 will create the entry-backed knowledge corpus and indexing flow.
- Story 1.3 will enforce ACL-safe retrieval and source actions.
- Story 1.4 and 1.4a will add real search routing, ranking, and filters.
- Story 1.5 will add grounded Ask-mode answers and server-enforced no-answer behavior.
- Story 1.6 will add citation inspection and evidence verification.
- Because those capabilities arrive later, Story 1.1 should scaffold reusable UI surfaces and state shapes, not hard-code fake result or citation contracts that future stories must unwind.

### Current Code Intelligence

- `src/pages/AIQuery.tsx` currently uses `useAppData()` plus a `buildLocalAnswer()` helper to do client-only keyword matching and render pretend assistant results. That behavior must be removed, not extended.
- The current page also renders a disconnected banner and `Ask AI` heading. Both conflict with the approved Phase 1 UX and should be replaced.
- `src/App.tsx` already provides `QueryClientProvider`, `AuthProvider`, `AppDataProvider`, and the `/ai/query` route inside `AppLayout` plus `RoleGuard`. No new root provider or route move is needed.
- `src/components/AppSidebar.tsx` and multiple content dashboard shortcuts still label `/ai/query` as `Ask AI`. Architecture guidance requires the shell to say `Assistant`.
- The repository already includes reusable UI primitives that match the UX spec: `Sheet`, `Drawer`, `Textarea`, `Card`, `Badge`, `Tabs`, `Tooltip`, `ScrollArea`, `Separator`, `Skeleton`, and `Sonner`.
- There is not yet a `src/features/assistant/` directory or `src/test/assistant/` directory. This story is expected to create them.

### Technical Requirements

- Keep the route at `/ai/query`.
- Keep the page inside the existing `AppLayout` and `RoleGuard` flow.
- Keep `AINewsletter` separate.
- Keep assistant feature logic out of `useAppData()` and out of `/api/bootstrap`.
- Keep new assistant UI logic under `src/features/assistant/*`.
- Keep `src/pages/AIQuery.tsx` as a thin wrapper only.
- Keep transient UI state such as selected mode, local transcript, starter prompts, backend-unavailable state, and mobile panel open/close state in page-local React state.
- Keep assistant status values aligned with the architecture's response-state vocabulary where possible (`loading | result | no_answer | error`), and add only clearly UI-local states such as `empty` or `unavailable` when needed.
- If a lightweight assistant availability check is introduced, it must live behind an assistant feature hook or API helper, not inside presentation components.
- Do not introduce new dependencies for sheet, drawer, textarea, or toast behavior; the project already ships those primitives.
- Do not add fake citations, fake result counts, or fake evidence previews just to fill the UI.
- Do not block future stories by baking search-specific or answer-specific assumptions into the shell component hierarchy.

### Architecture Compliance

- Preserve `useAuth()` and cookie-based `/api` requests as the auth boundary.
- Preserve the current route registration in `src/App.tsx`; the user-facing label changes, but the path does not.
- Follow the architecture client flow: `page shell -> assistant hook -> API helper -> mapper -> presentation component`.
- Presentation components must not call `fetch` directly.
- New assistant query or status types should live inside the assistant feature, not inside global bootstrap types.
- This story must avoid adding assistant server logic to `server/index.ts`, `server/db.ts`, or unrelated legacy modules.
- Because Story 1.1 is the first story in the epic, its biggest architectural responsibility is clean separation: route wrapper, feature folder, shell components, and no continued dependency on the legacy `AIQuery` local-answer path.

### UX and Interaction Requirements

- Header:
  - Title: `Assistant`
  - Subtitle: `Search and answer across Nerve knowledge with citations.`
  - Actions: `New conversation` and `Filters`
- Empty state:
  - Show a trust statement and 4 to 6 starter prompts.
  - Keep the page visually closer to Nerve's browse experience than to an empty chatbot canvas.
  - Starter prompts appear only while the transcript is empty.
- Composer:
  - Multiline input with min 2 lines and max 6 lines.
  - `Enter` submits.
  - `Shift+Enter` inserts newline.
  - Sticky placement on desktop and mobile.
- Modes:
  - `Auto`, `Search`, `Ask`
  - `Auto` selected by default on first load.
- Transcript:
  - In-page transcript only for the active session.
  - `New conversation` resets the current session without changing route or selected mode.
  - No multi-session saved history in this story.
- Responsive behavior:
  - Desktop: transcript area plus reserved context/evidence area.
  - Tablet/mobile: single column with sticky composer and filter/evidence sheet or drawer affordances.
- Unavailable/error copy:
  - Use calm, institutional language.
  - Explain what is unavailable, what still works, and what the user can do next.
  - Never imply that local fallback results are authoritative assistant output.

### Business and Launch Context

- This story is successful when the product visibly stops behaving like a disconnected demo and starts behaving like the trusted in-app assistant shell defined for Phase 1.
- The shell should increase trust before retrieval is even complete by removing misleading fallback behavior, keeping route/auth continuity, and preparing the exact UI surfaces later stories will fill with real search, answer, and citation data.
- Launch quality for this story is less about answer correctness and more about trust, continuity, accessibility, and safe handoff into the later RAG stories.

### File Structure Requirements

- Required new frontend module root:
  - `src/features/assistant/`
- Recommended initial file set for this story:
  - `src/features/assistant/components/AssistantPage.tsx`
  - `src/features/assistant/components/AssistantHeader.tsx`
  - `src/features/assistant/components/AssistantModeToggle.tsx` or `ModeBar.tsx`
  - `src/features/assistant/components/AssistantComposer.tsx`
  - `src/features/assistant/components/AssistantTranscript.tsx`
  - `src/features/assistant/components/AssistantEmptyState.tsx`
  - `src/features/assistant/components/AssistantStatusCard.tsx`
  - `src/features/assistant/components/AssistantContextPanel.tsx` or placeholder evidence/filter surface
  - `src/features/assistant/constants.ts`
  - `src/features/assistant/types.ts`
- Keep `src/pages/AIQuery.tsx` to the wrapper pattern:
  - `export default function AIQueryPage() { return <AssistantPage /> }`
- Update existing naming touchpoints:
  - `src/components/AppSidebar.tsx`
  - `src/pages/content/ContentAdminDashboard.tsx`
  - `src/pages/content/ContentSubAdminDashboard.tsx`
  - `src/pages/content/ContentUserDashboard.tsx`
- Put tests under:
  - `src/test/assistant/*`

### Testing Requirements

- Use the existing Vitest + Testing Library setup from `src/test/setup.ts`.
- Cover the following behaviors:
  - `Assistant` title and subtitle render on first visit.
  - `Auto` mode is selected by default.
  - Starter prompts render only when there is no transcript yet.
  - Submitting a prompt appends a user turn to the session transcript.
  - `New conversation` clears transcript state without changing route.
  - `Enter` submits and `Shift+Enter` keeps multiline editing behavior.
  - The backend-unavailable card renders instead of the legacy local fallback copy.
  - Live-region text updates when visible assistant status changes.
  - `Ask AI` labels are removed from the `/ai/query` shell touchpoints updated in this story.
- Prefer accessible queries in tests such as role, label text, visible headings, and status text.

### Reinvention and Regression Guardrails

- Do not evolve the old `buildLocalAnswer()` approach into a more complex fake assistant. Remove it.
- Do not move assistant data into `useAppData()` just because `AppLayout` still loads bootstrap data globally.
- Do not create direct `fetch` calls inside `AssistantPage` or low-level presentational components.
- Do not rename or relocate `/ai/query`.
- Do not change `RoleGuard` authorization logic for this story.
- Do not add upload actions, citations, source cards, or real evidence logic ahead of the stories that define them.
- Do not leave user-facing `Ask AI` labels behind in the main assistant shell after renaming to `Assistant`.

### Git Intelligence Summary

- Recent commits are planning and readiness focused:
  - `c35f4b8` added sprint tracking.
  - `404768e` updated the sprint change proposal.
  - `1e73966` refactored planning artifacts and UX specs for the Phase 1 MVP.
  - `5e9e3ee` added the UX design specification.
- There is no prior assistant feature implementation to preserve under `src/features/assistant/*`.
- The working tree was clean when this story was created.

### Latest Tech Information

- TanStack Query's official React overview emphasizes that it is for fetching, caching, synchronizing, and updating server state. Since `src/App.tsx` already mounts a root `QueryClientProvider`, assistant hooks should reuse that provider instead of adding a second query client or duplicating async state with ad hoc `useEffect` fetch code. [Source: https://tanstack.com/query/latest/docs/framework/react/overview]
- MDN's ARIA live-region guidance says live regions should exist before content changes occur, should usually use `aria-live="polite"` for non-urgent updates, and should start empty before text updates are injected. Apply that pattern to retrieval/generation/error status announcements rather than creating/removing announcer nodes on the fly. [Source: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions]

### Project Structure Notes

- The architecture expects `src/features/assistant/*` even though the folder does not exist yet. Creating it in this story aligns the codebase with the planned long-term structure.
- `AppLayout` still depends on `useAppData()` for the rest of the application. That global bootstrap dependency remains for now, but this story should avoid increasing assistant coupling to it.
- Existing UI primitives already cover the responsive surfaces needed by this story, so the implementation should reuse local components instead of adding new libraries.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Epic 1 overview
  - Story 1.1 acceptance criteria
  - Stories 1.2 through 1.6 for dependency boundaries
- `_bmad-output/planning-artifacts/prd.md`
  - Business Success
  - Technical Success
  - MVP scope
  - Functional requirements FR1, FR2, FR3, FR5
  - Accessibility and reliability non-functional requirements
- `_bmad-output/planning-artifacts/architecture.md`
  - Frontend Architecture
  - State management decision
  - UI structure
  - UX behavior rules
  - Structure Patterns
  - Project Structure and Boundaries
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - Header
  - Composer
  - Query Modes and Response Selection
  - First Visit / Empty State
  - Empty, Loading, Error, and No-Answer States
  - Conversation History Behavior
  - Accessibility and Usability Considerations
  - Responsive Strategy
  - Reuse and Implementation Notes
- `_bmad-output/project-context.md`
  - Technology Stack and Versions
- `src/App.tsx`
  - Existing `QueryClientProvider`
  - Existing `/ai/query` route registration
- `src/pages/AIQuery.tsx`
  - Legacy local keyword fallback to remove
- `src/components/AppLayout.tsx`
  - Existing shared shell/loading/error behavior
- `src/components/RoleGuard.tsx`
  - Existing route protection behavior to preserve
- `src/components/AppSidebar.tsx`
  - Existing `Ask AI` label to rename
- `src/lib/api.ts`
  - Existing authenticated API client pattern
- `src/components/ui/sheet.tsx`
  - Existing sheet primitive for mobile filters/evidence
- `src/components/ui/drawer.tsx`
  - Existing drawer primitive for mobile affordances
- `src/components/ui/textarea.tsx`
  - Existing textarea primitive to reuse for multiline composer
- https://tanstack.com/query/latest/docs/framework/react/overview
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story creation workflow: `bmad-create-story`
- Sprint status auto-discovery selected `1-1-replace-the-legacy-aiquery-page-with-the-assistant-workspace`
- Latest tech check sources:
  - TanStack Query React overview
  - MDN ARIA live regions
- Validation commands:
  - `npm test -- src/test/assistant/AssistantPage.test.tsx src/test/assistant/AssistantShellLabels.test.tsx`
  - `npm test`
  - `./node_modules/.bin/eslint src/pages/AIQuery.tsx src/components/AppSidebar.tsx src/pages/content/ContentAdminDashboard.tsx src/pages/content/ContentSubAdminDashboard.tsx src/pages/content/ContentUserDashboard.tsx src/features/assistant src/test/assistant`
  - `npm run lint` (blocked by `EACCES` on `.local/postgres-data`)
  - `npm run build` (client build passed; server build surfaced pre-existing TypeScript issues in `server/index.ts` and `server/mailer.ts`)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 1.1 was created as the first Epic 1 story, so Epic 1 should be tracked as `in-progress`.
- This story intentionally avoids fake assistant behavior and keeps later search/answer/citation work for subsequent stories.
- Replaced the legacy `/ai/query` demo page with a thin route wrapper plus a new `src/features/assistant/*` module for the empty-state shell, local transcript, sticky composer, live-region announcer, and reserved filter/evidence surfaces.
- Renamed the `/ai/query` shell touchpoints from `Ask AI` to `Assistant` in the sidebar and content dashboards while preserving the existing route, `AppLayout`, and `RoleGuard` boundaries.
- Added assistant regression tests covering the shell, unavailable-state guardrails, keyboard submission behavior, transcript reset behavior, and `/ai/query` label continuity.
- Validation outcome: `npm test` passed (7 tests total) and targeted ESLint passed for all changed files; repo-wide `npm run lint` is currently blocked by workspace permissions on `.local/postgres-data`, and the server portion of `npm run build` still fails on pre-existing TypeScript issues unrelated to this story.

### File List

- `_bmad-output/implementation-artifacts/1-1-replace-the-legacy-aiquery-page-with-the-assistant-workspace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/components/AppSidebar.tsx`
- `src/pages/AIQuery.tsx`
- `src/pages/content/ContentAdminDashboard.tsx`
- `src/pages/content/ContentSubAdminDashboard.tsx`
- `src/pages/content/ContentUserDashboard.tsx`
- `src/features/assistant/api.ts`
- `src/features/assistant/constants.ts`
- `src/features/assistant/index.ts`
- `src/features/assistant/types.ts`
- `src/features/assistant/hooks/useAssistantAvailability.ts`
- `src/features/assistant/components/AssistantComposer.tsx`
- `src/features/assistant/components/AssistantContextPanel.tsx`
- `src/features/assistant/components/AssistantEmptyState.tsx`
- `src/features/assistant/components/AssistantHeader.tsx`
- `src/features/assistant/components/AssistantModeToggle.tsx`
- `src/features/assistant/components/AssistantPage.tsx`
- `src/features/assistant/components/AssistantStatusAnnouncer.tsx`
- `src/features/assistant/components/AssistantStatusCard.tsx`
- `src/features/assistant/components/AssistantTranscript.tsx`
- `src/test/assistant/AssistantPage.test.tsx`
- `src/test/assistant/AssistantShellLabels.test.tsx`

### Change Log

- 2026-04-05: Replaced the legacy `/ai/query` local-answer demo with the assistant workspace shell, renamed shell labels to `Assistant`, and added assistant regression tests.
