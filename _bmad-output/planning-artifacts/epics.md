---
stepsCompleted:
  - "step-01-validate-prerequisites"
  - "step-02-design-epics"
  - "step-03-create-stories"
  - "step-04-final-validation"
inputDocuments:
  - "/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/prd.md"
  - "/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/architecture.md"
  - "/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/ux-design-specification.md"
---

# Nerve - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Nerve, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Authenticated users can open a single assistant workspace inside Nerve for both natural-language search and grounded question answering.
FR2: Authenticated users can submit natural-language queries in `Auto`, `Search`, or `Ask` mode.
FR3: Authenticated users can refine, rephrase, or continue a prior query within the same assistant session.
FR4: Authenticated users can apply source and metadata filters to narrow assistant results.
FR5: Authenticated users can see clear loading, processing, empty, error, and no-answer states during assistant use.
FR6: Authenticated users can receive either an answer-focused response or a results-focused response from the same assistant experience, depending on query intent.
FR7: Authenticated users can search across existing Nerve entries and indexed knowledge assets from one query surface.
FR8: Authenticated users can discover content through semantic topic matching.
FR9: Authenticated users can discover content through exact keyword and phrase matching.
FR10: Authenticated users can discover content using metadata such as department, content type, academic year, source kind, owner, or visibility context.
FR11: Authenticated users can receive assistant results spanning plain-text content, uploaded files, PDFs, and image-derived text.
FR12: Authenticated users can view source descriptors, snippets, and content-type indicators for returned results.
FR13: Authenticated users can open an authorized source directly from a result card or source list.
FR14: Authenticated users can receive answers grounded only in retrievable source evidence.
FR15: Authenticated users can see citations for every substantive assistant answer.
FR16: Authenticated users can inspect the supporting evidence behind each citation, including relevant snippets or source locators.
FR17: Authenticated users can receive an explicit insufficient-evidence response when the assistant cannot support a reliable answer.
FR18: Authenticated users can receive ranked source results instead of narrative synthesis when the query is better served as search.
FR19: Authorized operators can inspect which sources supported a stored or reviewed assistant answer.
FR20: The system can limit assistant retrieval to sources the current user is authorized to access.
FR21: The system can enforce the same authorization rules for results, snippets, citations, previews, and source-open actions.
FR22: Authorized admins can define whether indexed content is visible to all authenticated users, a team, an owner, or an explicit allowed audience.
FR23: Authorized admins can update ownership, team visibility, or source access rules for indexed content.
FR24: The system can reflect changed permissions in assistant behavior without exposing previously accessible but now-restricted content.
FR25: The system can index existing Nerve entries as assistant knowledge sources.
FR26: Authorized users can submit new files to the assistant knowledge corpus.
FR27: Authorized users can submit PDFs for searchable and citable retrieval.
FR28: Authorized users can submit images for text-grounded retrieval.
FR29: The system can represent plain text, files, PDFs, and image-derived content within one searchable knowledge corpus.
FR30: The system can refresh or replace indexed knowledge when a source changes.
FR31: Authenticated users and admins can see whether a newly submitted source is processing, ready, failed, or otherwise unavailable.
FR32: Authorized admins can view indexed asset status and retrieval readiness.
FR33: Authorized admins can retry failed processing or reindex a source.
FR34: Authorized operators can investigate retrieval failures, citation mismatches, and permission-related assistant issues.
FR35: Authorized product or operations users can review assistant usage, source-open activity, citation coverage, no-answer behavior, and ingestion failure signals.
FR36: Authenticated users can view saved assistant threads.
FR37: Authenticated users can reopen a prior thread and continue the conversation with preserved context.
FR38: The system can persist citations alongside saved assistant answers for later review.

### NonFunctional Requirements

NFR1: Search-mode responses must achieve p95 latency of 2.5 seconds or less for the initial brownfield corpus under normal expected load.
NFR2: Answer-mode responses must achieve p95 latency of 8 seconds or less for grounded responses, excluding asynchronous ingestion time.
NFR3: Core assistant interactions must expose immediate visible state changes for loading, processing, failure, and no-answer outcomes so users are never left without system feedback.
NFR4: Entry-based knowledge updates must become searchable within 5 minutes of create or update during phase 1.
NFR5: Source-open actions for authorized content must complete without forcing users through a separate unauthenticated workflow.
NFR6: All assistant queries, results, citations, previews, and source-open actions must require an authenticated Nerve session.
NFR7: The assistant must enforce authorization consistently across retrieval, answer generation, snippets, citations, and source access.
NFR8: The system must produce zero unauthorized filename, snippet, citation, or source-link leakage in blocked-source security tests.
NFR9: Uploaded assistant content and stored assistant data must be protected in transit and at rest according to production security standards used for the rest of the Nerve application.
NFR10: Privileged assistant operations such as source upload, reindex, retry, permission changes, and source-access decisions must be auditable by authorized operators.
NFR11: The assistant must fail safely: when evidence is weak, source access is denied, or a model dependency is unavailable, the system must return a no-answer or search-style response rather than an unsupported narrative answer.
NFR12: Ingestion failures must be surfaced with explicit status so users and operators can distinguish processing failure from missing content.
NFR13: Failed ingestion or indexing work must be retryable without requiring the source to be recreated from scratch.
NFR14: Retrieval and citation behavior must remain consistent enough that operators can trace an answer back to the supporting source set during investigation.
NFR15: The assistant must degrade gracefully when downstream AI services are unavailable, instead of presenting misleading success states.
NFR16: 100% of non-abstaining substantive answers must include at least one citation.
NFR17: The assistant must abstain when available evidence does not meet the minimum support threshold defined for grounded answering.
NFR18: At least 85% of curated grounded-answer evaluation queries must be judged supported by their cited evidence.
NFR19: At least 90% of curated no-answer evaluation queries must correctly abstain instead of producing speculative answers.
NFR20: Search quality must return a relevant source in the top 5 results for at least 90% of curated known-answer search queries in the launch evaluation set.
NFR21: Core assistant flows must meet WCAG 2.1 AA expectations for keyboard operation, focus management, semantics, labeling, and readable content structure.
NFR22: Accessibility coverage must include the query composer, mode controls, filters, result cards, citation chips, evidence views, and source-open actions.
NFR23: No trust-critical information may be conveyed by color alone.
NFR24: Assistant responses, citations, and evidence panels must remain usable with screen readers and keyboard-only navigation.
NFR25: The product must track assistant request latency, retrieval latency, ingestion success/failure, no-answer rate, citation coverage, and blocked-source security test results.
NFR26: The product must track model usage and per-request cost signals for generation, embedding, and extraction workloads.
NFR27: Operators must be able to distinguish retrieval failures, permission failures, ingestion failures, and model/provider failures in operational telemetry.
NFR28: Launch readiness must include a golden-query evaluation set covering exact-match queries, semantic queries, no-answer scenarios, and ACL-sensitive scenarios.

### Additional Requirements

- Implement the assistant as a brownfield extension of the existing React SPA, Express API, and PostgreSQL runtime rather than as a new service or a revived Supabase runtime.
- Preserve the `/ai/query` route, `AppLayout`, `RoleGuard`, `useAuth()`, same-origin `/api` access, and the current session-authenticated trust boundary.
- Keep PostgreSQL as the single authority for business data, permissions, indexed knowledge metadata, chunks, job state, and citation traceability.
- Ship the rollout in phases: Phase 1 entry-backed assistant replacement, Phase 2 private uploads and extraction, Phase 3 asset governance and operator tooling, later phases for saved threads, analytics, and tuning.
- Treat `entries` as the first indexed corpus and the first implementation priority for the vertical slice.
- Use PostgreSQL 16 with `pgvector`, `pg_trgm`, and full-text search to support hybrid retrieval.
- Use Azure AI Foundry with `gpt-4.1-mini` for grounded answers, `gpt-4.1-nano` for lightweight intent or fallback tasks, and `text-embedding-3-small` for embeddings.
- Use `mistral-document-ai-2512` with `mistral-document-ai-2505` fallback when file/PDF/image extraction is introduced.
- Add a dedicated `server/rag/*` module family and avoid expanding assistant logic inside `server/index.ts`, `server/db.ts`, or `useAppData()`.
- Add frontend feature modules under `src/features/assistant/*` and keep `src/pages/AIQuery.tsx` as a thin route wrapper.
- Use versioned SQL migrations under `server/migrations/` rather than embedding more long-lived schema bootstrap DDL in `server/db.ts`.
- Add RAG schema tables for `knowledge_assets`, `knowledge_asset_versions`, `knowledge_chunks`, `knowledge_acl_principals`, and `knowledge_jobs`, with optional later `assistant_threads`, `assistant_messages`, and `assistant_message_citations`.
- Use shared status enums for asset state (`pending | processing | ready | failed | deleted`), job state (`queued | running | succeeded | failed | dead_letter`), and assistant response state (`loading | result | no_answer | error`).
- Enforce ACL from authoritative relational data using the same decision path for retrieval candidates, snippets, citations, previews, downloads, and privileged job visibility.
- Keep assistant uploads private and inaccessible through the current public `/uploads` static-serving pattern; use authenticated proxy or signed access behind ACL checks instead.
- Introduce REST endpoints under `/api/assistant` and `/api/knowledge` for queries, uploads, assets, jobs, downloads, and future thread retrieval.
- Keep assistant API response shapes explicit, with named payload wrappers, `mode: auto | search | ask`, and machine-readable `grounded` and `enough_evidence` flags.
- Enforce no-answer behavior on the server by gating generation on evidence sufficiency before the model is invoked.
- Implement the retrieval pipeline as deterministic mode resolution plus hybrid candidate generation, ACL-safe fusion, adjacent-chunk collapse, evidence sufficiency checks, and grounded generation over selected evidence only.
- Store machine-usable `citation_locator` metadata per retrieval chunk, including asset, version, chunk, page/section, and character offsets.
- Use React Query for assistant-specific network state, uploads, job polling, and source details; do not load assistant state through `/api/bootstrap`.
- Add a worker process in the same repo and deployment family, backed by a PostgreSQL job queue using `FOR UPDATE SKIP LOCKED`, retries, backoff, and dead-letter handling.
- Extend configuration for model providers, extraction credentials, storage backend, worker polling/retry settings, and assistant feature flags.
- Add observability for request IDs, stage timings, retrieval counts, no-answer rate, ingestion/job failures, and provider cost metrics.
- Organize tests across `src/test/assistant/*`, `server/test/rag/*`, and `tests/e2e/assistant/*`.
- Keep deployment on Nginx + Docker Compose + PostgreSQL, adding a `worker` service from the same application image instead of changing the hosting topology.
- Treat the architecture handoff priority as a thin vertical slice: migrations and RAG scaffolding, entry indexing, `POST /api/assistant/query`, assistant page replacement, then citations/search/ask/no-answer behavior.

### UX Design Requirements

UX-DR1: Keep the assistant at `/ai/query` inside the existing `AppLayout` and `RoleGuard` flow, while updating the sidebar label from `Ask AI` to `Assistant` without changing the route.
UX-DR2: Implement the page with five primary regions: header, mode bar, main results column, context/evidence rail, and sticky composer.
UX-DR3: On desktop, use a two-column workspace with an approximately 8/12 main transcript column and 4/12 sticky context rail.
UX-DR4: On mobile and tablet, collapse to a single-column layout with a sticky bottom composer, a filter sheet, and an evidence sheet or drawer.
UX-DR5: Add a header that shows the page title `Assistant`, the subtitle `Search and answer across Nerve knowledge with citations.`, and the actions `New conversation`, `Filters`, and role-gated `Add source`.
UX-DR6: Replace the current disconnected-backend warning with a full-width status card that explains what is unavailable and what still works.
UX-DR7: Implement a multiline composer with a 2-line minimum height, 6-line maximum height, `Enter` to submit, and `Shift+Enter` for newline.
UX-DR8: Keep the currently selected mode visible adjacent to the composer and show active filters as removable chips above the composer across turns until cleared.
UX-DR9: Provide an empty-state first-visit experience with a trust statement and 4 to 6 starter prompt chips such as policy lookup, summary, and document discovery prompts.
UX-DR10: Implement a segmented mode control for `Auto`, `Search`, and `Ask`, with `Auto` selected by default on first load.
UX-DR11: Encode Auto-mode behavior so retrieval-oriented verbs resolve to search-first, synthesis-oriented prompts resolve to answer-first, and ambiguous prompts can return a mixed response.
UX-DR12: Render search-style responses with a top summary row, visible active facets, ranked source cards, five default results, and a `Show more results` control.
UX-DR13: Build source cards with source icon, content-type badge, title, secondary metadata, emphasized snippet or OCR excerpt, citation locator where available, and permission-safe actions for `Preview`, `Open source`, and `Download`.
UX-DR14: Render answer-style responses with a concise answer card, inline citation chips attached to each substantive claim cluster, and a supporting evidence block under the answer.
UX-DR15: Support mixed responses in `Auto` mode by combining a short grounded answer with a clearly labeled supporting source section.
UX-DR16: Provide content-type-specific evidence previews for entries, PDFs, documents/plain text files, and images, including locators such as page number, heading path, or OCR excerpt.
UX-DR17: Render citation chips as short labels like `S1`, `S2`, and `S3`, optionally including page hints, with hover/focus summaries on desktop and click behavior that opens the matching evidence item.
UX-DR18: Implement an evidence rail that shows the selected citation preview, the list of cited sources for the current answer, source actions, and status badges while preserving keyboard navigation and selection state.
UX-DR19: Enforce permission-safe display rules in the UI by omitting blocked titles, filenames, snippets, page counts, result counts that imply hidden documents, citation labels, and tease-and-block controls.
UX-DR20: Implement default filters for content type, department, date range, and sort, plus privileged filters for team, owner, visibility scope, and indexing status when the user's role makes them meaningful.
UX-DR21: Keep every active facet visible as a removable chip, provide `Clear all` when filters exist, and persist filter selections across turns within the current session.
UX-DR22: Implement distinct empty, retrieving, generating-answer, no-results, no-evidence, low-confidence, source-processing, source-failed, and error states with calm, institutional copy and clear next actions.
UX-DR23: Ensure no-evidence and low-confidence states offer specific follow-ups such as switching to `Search`, clearing filters, trying a department or document name, or reviewing related accessible sources.
UX-DR24: Support MVP conversation continuity as an in-page transcript plus `New conversation` reset, without introducing multi-session saved history in the first replacement of `AIQuery.tsx`.
UX-DR25: Meet UX accessibility expectations for visible focus, keyboard navigation, `aria-live` status updates, descriptive citation accessible names, 44x44 touch targets, and text alternatives for image previews and OCR-backed source cards.
UX-DR26: Reuse existing Nerve visual and interaction patterns where possible, including `Card`, `Badge`, `Tabs`, `Tooltip`, `ScrollArea`, `Accordion`, `Separator`, `Skeleton`, `Sheet`, `Dialog`, `Toast`/`Sonner`, and browse-style filter conventions.
UX-DR27: Ensure launch UX acceptance includes clickable citations on every substantive answer, evidence inspection without leaving the page, mobile usability for querying/filtering/evidence/source access, and zero blocked-content leakage through names, snippets, counts, or citation labels.

### FR Coverage Map

FR1: Epic 1 - Single brownfield assistant workspace at `/ai/query`
FR2: Epic 1 - `Auto`, `Search`, and `Ask` query modes
FR3: Epic 1 - In-session query refinement and follow-up
FR4: Epic 1 - Filtered assistant retrieval
FR5: Epic 1 - Loading, empty, error, and no-answer states
FR6: Epic 1 - Search-first versus answer-first response selection
FR7: Epic 1 - Unified retrieval over existing Nerve entry knowledge
FR8: Epic 1 - Semantic discovery for entry content
FR9: Epic 1 - Exact-match and phrase retrieval
FR10: Epic 1 - Metadata-aware ranking and filtering
FR11: Epic 2 - Mixed-media retrieval across files, PDFs, and images
FR12: Epic 1 - Source descriptors, snippets, and content-type indicators
FR13: Epic 1 - Authorized source-open actions from results
FR14: Epic 1 - Grounded answers from accessible evidence
FR15: Epic 1 - Citation-backed substantive answers
FR16: Epic 1 - Evidence inspection for each citation
FR17: Epic 1 - Explicit insufficient-evidence responses
FR18: Epic 1 - Search-style fallback when synthesis is unsafe
FR19: Epic 3 - Operator review of supporting sources for investigated answers
FR20: Epic 1 - Retrieval limited to authorized sources
FR21: Epic 1 - ACL enforcement across snippets, citations, previews, and source-open flows
FR22: Epic 2 - Admin-defined visibility scopes for indexed assets
FR23: Epic 2 - Admin updates to ownership, team visibility, and source access
FR24: Epic 2 - Permission changes reflected safely in assistant behavior
FR25: Epic 1 - Existing `entries` indexed as assistant knowledge
FR26: Epic 2 - File submission into the assistant knowledge corpus
FR27: Epic 2 - PDF ingestion for searchable and citable retrieval
FR28: Epic 2 - Image ingestion for text-grounded retrieval
FR29: Epic 2 - Unified searchable corpus across text and uploaded asset types
FR30: Epic 2 - Refresh and replacement of indexed knowledge when sources change
FR31: Epic 2 - Status visibility for processing, ready, failed, and unavailable sources
FR32: Epic 3 - Asset readiness and indexed-status monitoring
FR33: Epic 3 - Retry and reindex controls for failed processing
FR34: Epic 3 - Diagnostics for retrieval, citation, and permission issues
FR35: Epic 4 - Usage, citation, no-answer, and ingestion-signal review for continuous improvement
FR36: Epic 4 - Saved assistant thread list
FR37: Epic 4 - Reopen and continue prior conversations
FR38: Epic 4 - Persisted citations with saved assistant answers

## Epic List

### Epic 1: Replace AIQuery with a Trusted Entry Assistant
Authenticated Nerve users can search and ask across existing entry knowledge in one assistant workspace, receive grounded answers or search-style results, inspect citations, and open only the sources they are allowed to access.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR20, FR21, FR25.
**Implementation notes:** Phase 1 brownfield release. Keep `/ai/query`, `AppLayout`, and the current auth boundary while delivering the first server-backed RAG slice over existing `entries` only.

### Epic 2: Expand the Assistant to Private Files, PDFs, and Images
Admins can add governed knowledge beyond entries, and users can retrieve mixed-media content with the same permission-safe citations, source actions, and status-aware experience.
**FRs covered:** FR11, FR22, FR23, FR24, FR26, FR27, FR28, FR29, FR30, FR31.
**Implementation notes:** Phase 2 rollout. Add private storage, extraction, ingestion status, asset ACL management, and mixed-media retrieval without destabilizing the phase-1 assistant flow.

### Epic 3: Give Admins and Operators Control Over Knowledge Readiness and Trust
Admins and operators can monitor indexed asset readiness, retry or reindex failed sources, and investigate retrieval, citation, and permission issues with enough traceability to explain assistant behavior.
**FRs covered:** FR19, FR32, FR33, FR34.
**Implementation notes:** Phase 3 rollout. Build operator-facing controls on top of the knowledge jobs, asset states, and citation traceability established in the earlier epics.

### Epic 4: Add Conversation Memory and Quality Feedback Loops
Returning users can reopen trusted conversations with preserved evidence, while product and operations teams can review usage, citation coverage, no-answer behavior, and ingestion signals to improve the assistant over time.
**FRs covered:** FR35, FR36, FR37, FR38.
**Implementation notes:** Later-phase expansion. Add thread persistence, stored citation history, and continuous-improvement analytics once the request, citation, and operational event model is stable from the earlier rollout phases.

## Epic 1: Replace AIQuery with a Trusted Entry Assistant

Authenticated Nerve users can search and ask across existing entry knowledge in one assistant workspace, receive grounded answers or search-style results, inspect citations, and open only the sources they are allowed to access.

### Story 1.1: Replace the Legacy AIQuery Page with the Assistant Workspace

As an authenticated Nerve user,
I want a native assistant workspace at `/ai/query`,
So that I can start trusted search and question answering inside the existing app shell.

**FRs implemented:** FR1, FR2, FR3, FR5

**Acceptance Criteria:**

**Given** an authenticated user opens `/ai/query`
**When** the page loads
**Then** the user sees the new assistant page inside the existing `AppLayout` and `RoleGuard` flow
**And** the legacy local-keyword fallback experience is no longer shown.

**Given** the assistant page is opened for the first time in a session
**When** no query has been submitted yet
**Then** the page shows the `Assistant` title, helper text, `Auto/Search/Ask` mode controls, a sticky composer, and starter prompts
**And** `Auto` is the default selected mode.

**Given** a user has already submitted a query in the current assistant session
**When** they refine, rephrase, or continue that query from the same workspace
**Then** the next turn is appended to the in-page session transcript
**And** the assistant preserves the current conversation context until the user starts a new conversation.

**Given** the user is on a mobile or tablet viewport
**When** the assistant page renders
**Then** the layout collapses to a single-column flow with a sticky composer
**And** filter and evidence affordances are available through sheet or drawer patterns.

**Given** the assistant backend is unavailable
**When** the user opens `/ai/query`
**Then** the page shows a full-width status card explaining what is unavailable
**And** it does not fall back to the disconnected local-answer behavior.

### Story 1.2: Index Existing Entries as the Phase 1 Knowledge Corpus

As an authenticated Nerve user,
I want the current Nerve entries to be searchable by the assistant,
So that the first production release answers from live institutional content.

**FRs implemented:** FR7, FR25

**Acceptance Criteria:**

**Given** the Phase 1 migrations are run
**When** the application and worker start
**Then** the RAG schema objects needed for entry-backed retrieval exist
**And** the schema is created through versioned migrations rather than new inline bootstrap DDL.

**Given** existing Nerve entries are present
**When** the entry indexing flow runs
**Then** each eligible entry is represented as a knowledge asset with versioned chunked content and citation locator metadata
**And** entry metadata needed for ranking and filtering is preserved.

**Given** an entry is created or updated
**When** the reindex flow is triggered
**Then** the changed content becomes searchable within 5 minutes
**And** the previously indexed version is superseded safely.

**Given** Phase 1 is active
**When** assistant queries run
**Then** the searchable corpus is limited to existing entry-backed knowledge
**And** no file, PDF, or image upload content is referenced yet.

### Story 1.3: Deliver Permission-Safe Entry Search

As an authenticated Nerve user,
I want the assistant to search only the entries I can access,
So that results, snippets, and source actions stay trustworthy and private.

**FRs implemented:** FR13, FR20, FR21

**Acceptance Criteria:**

**Given** an authenticated user submits a query
**When** retrieval candidates are built
**Then** the assistant evaluates access using the current session, role, team, ownership, and visibility rules
**And** unauthorized entries are excluded before snippets or citations are assembled.

**Given** a query returns results
**When** the result list is rendered
**Then** each result includes only authorized title, snippet, and source metadata
**And** no blocked-source names, counts, or teaser actions are exposed.

**Given** a user attempts to preview or open a source they are not authorized to access
**When** the request reaches the API
**Then** the request is rejected with an authorization error
**And** the response does not leak protected source metadata.

**Given** a blocked-source regression test is executed
**When** assistant retrieval and source-open flows are validated
**Then** the leakage rate for unauthorized filenames, snippets, citations, and links is zero
**And** the test outcome is recorded as a launch-quality gate.

### Story 1.4: Add Hybrid Search, Intent Routing, and Filtered Result Lists

As an authenticated Nerve user,
I want the assistant to return strong search results for discovery-style queries,
So that I can quickly find the right entry without leaving the assistant workflow.

**FRs implemented:** FR4, FR6, FR7, FR8, FR9, FR10, FR12, FR18

**Acceptance Criteria:**

**Given** a user submits a known-item or discovery query in `Search` mode or `Auto` mode
**When** the request is processed
**Then** the assistant returns a search-style response with ranked entry results
**And** ranking combines semantic similarity, exact match behavior, and metadata-aware retrieval.

**Given** a user applies supported filters such as department, content type, date range, or sort
**When** a query is submitted
**Then** the API applies those filters to retrieval and ranking
**And** the active filters remain visible as removable chips across turns until cleared.

**Given** more than five accessible results are found
**When** the result group is displayed
**Then** the page shows a summary row with result count and active facets
**And** the UI initially renders five results with a `Show more results` control.

**Given** no accessible entries match the request
**When** the response is returned
**Then** the assistant shows a neutral no-results state with refinement suggestions
**And** the user can retry without retyping the original query.

### Story 1.5: Deliver Grounded Ask Mode with Server-Enforced No-Answer Behavior

As an authenticated Nerve user,
I want answer-style responses that only use supported entry evidence,
So that I can trust the assistant when it summarizes or explains knowledge.

**FRs implemented:** FR2, FR6, FR14, FR15, FR17, FR18

**Acceptance Criteria:**

**Given** a user submits a synthesis-oriented question in `Ask` mode or `Auto` mode
**When** the evidence threshold is met
**Then** the assistant returns a concise grounded answer
**And** every substantive claim cluster includes at least one inline citation.

**Given** the available accessible evidence is weak, conflicting, or insufficient
**When** the request is evaluated on the server
**Then** the system returns a no-answer or search-style fallback response
**And** the model is not asked to generate a confident unsupported narrative.

**Given** an answer response is returned
**When** the client renders it
**Then** the payload includes explicit `grounded` and `enough_evidence` state
**And** helpful follow-up suggestions are available for the user.

**Given** curated no-answer evaluation queries are run
**When** Phase 1 quality is assessed
**Then** at least 90% of those queries correctly abstain
**And** unsupported narrative answers are treated as launch-blocking defects.

### Story 1.6: Add Citation Inspection and Entry Evidence Verification

As an authenticated Nerve user,
I want to inspect citations and open the supporting entry evidence,
So that I can verify what the assistant is claiming without leaving the trust boundary.

**FRs implemented:** FR13, FR15, FR16

**Acceptance Criteria:**

**Given** an answer includes citations
**When** the user clicks or focuses a citation chip
**Then** the assistant opens the evidence rail with the selected citation highlighted
**And** the rail shows the related snippet, source metadata, and available source actions.

**Given** the user navigates citations with keyboard only
**When** citation chips and evidence items receive focus
**Then** focus order remains clear and visible
**And** citation controls expose descriptive accessible names for screen readers.

**Given** the cited source is an entry
**When** the user chooses `Preview` or `Open source`
**Then** the assistant shows the relevant entry excerpt or opens the authenticated entry detail flow
**And** the evidence remains linked to the originating citation.

**Given** the system is rendering evidence and citation states
**When** trust-critical information is displayed
**Then** status is not conveyed by color alone
**And** no blocked citation or snippet is shown.

### Story 1.7: Add Phase 1 Telemetry, Evaluation, and Rollout Guardrails

As a product owner or operator,
I want launch-quality visibility into assistant quality and failures,
So that the entry-backed rollout can be monitored and trusted in production.

**FRs implemented:** FR14, FR15, FR17, FR20, FR21, FR25

**Acceptance Criteria:**

**Given** an assistant request is processed
**When** the request completes or fails
**Then** the system records a request ID, stage timings, mode, no-answer outcome, and failure classification
**And** retrieval, permission, and provider failures are distinguishable in telemetry.

**Given** grounded answers are produced
**When** quality metrics are computed
**Then** citation coverage and latency metrics are recorded
**And** search and answer paths can be compared against their p95 targets.

**Given** the Phase 1 evaluation suite is run
**When** launch readiness is reviewed
**Then** the suite covers exact-match, semantic, no-answer, and ACL-sensitive entry scenarios
**And** results are available to product and engineering stakeholders.

**Given** regressions appear after rollout
**When** operators inspect the assistant signals
**Then** they can identify whether the issue is retrieval quality, permission enforcement, or downstream provider instability
**And** the rollout can be governed with evidence instead of anecdote.

## Epic 2: Expand the Assistant to Private Files, PDFs, and Images

Admins can add governed knowledge beyond entries, and users can retrieve mixed-media content with the same permission-safe citations, source actions, and status-aware experience.

### Story 2.1: Add Role-Gated Private Source Uploads

As an admin or sub-admin,
I want to upload assistant knowledge sources through the existing Nerve UI,
So that I can expand the searchable corpus without using external workflows.

**FRs implemented:** FR26, FR31

**Acceptance Criteria:**

**Given** a user with upload permissions opens the assistant page
**When** they view the page header
**Then** they see an `Add source` action
**And** users without upload permissions do not see that action.

**Given** an authorized user starts an upload
**When** they submit a supported file, PDF, or image with ownership and visibility metadata
**Then** the API creates a knowledge asset record and stores the binary in private storage
**And** the asset is not exposed through the public `/uploads` static path.

**Given** an upload succeeds
**When** the API returns
**Then** the asset begins in a non-ready lifecycle state such as `pending` or `processing`
**And** the user receives a confirmation that indexing is underway.

**Given** an unsupported or invalid upload is submitted
**When** validation fails
**Then** the user receives a clear error message
**And** no partial public artifact is left behind.

### Story 2.2: Ingest PDFs with Page-Level Citation Support

As an admin,
I want uploaded PDFs to become searchable and citable,
So that users can ask questions against document pages and verify the evidence directly.

**FRs implemented:** FR27, FR29, FR31

**Acceptance Criteria:**

**Given** a PDF asset enters the ingestion queue
**When** extraction runs
**Then** the system uses the configured Mistral document extraction provider
**And** the fallback extractor is used when the primary extractor fails in a retryable way.

**Given** PDF extraction succeeds
**When** chunking and indexing complete
**Then** the resulting knowledge chunks preserve page locators and citation metadata
**And** the PDF becomes available for retrieval with page-aware snippets.

**Given** PDF extraction fails
**When** ingestion status is updated
**Then** the asset is marked `failed` with operator-visible failure context
**And** it is excluded from answer generation until reprocessed successfully.

**Given** a user later retrieves a PDF-backed answer or result
**When** citations or previews are rendered
**Then** the UI can show page references such as `p.4`
**And** source-open behavior can target the authenticated PDF viewer or download proxy.

### Story 2.3: Ingest Images and Documents for OCR-Backed Retrieval

As an admin,
I want uploaded images and document files to be indexed alongside text content,
So that posters, scans, and document files can participate in grounded retrieval.

**FRs implemented:** FR28, FR29, FR31

**Acceptance Criteria:**

**Given** an uploaded image or supported document file enters ingestion
**When** extraction completes successfully
**Then** the system stores normalized extracted text for retrieval
**And** the resulting chunks preserve source-kind and media-type metadata.

**Given** an image includes weak or partial OCR output
**When** that content is indexed
**Then** the assistant can still return search-style results when relevant
**And** grounded answer generation respects evidence sufficiency rather than overstating confidence.

**Given** extraction for an image or document fails
**When** the job completes
**Then** the asset is marked with a failed status visible to permitted users
**And** the failure does not corrupt existing ready assets.

**Given** a user retrieves an image-backed or document-backed result
**When** the result is displayed
**Then** the source card shows the correct content-type badge and excerpt behavior
**And** preview/open flows remain inside the authenticated trust boundary.

### Story 2.4: Manage Asset Visibility, Ownership, and Permission Refresh

As an admin,
I want to control who can access uploaded knowledge assets,
So that assistant retrieval respects team, owner, and explicit audience boundaries.

**FRs implemented:** FR22, FR23, FR24

**Acceptance Criteria:**

**Given** an authorized admin uploads or edits a knowledge asset
**When** they choose a visibility scope
**Then** the system supports authenticated-wide, team, owner, or explicit audience access rules
**And** uploaded assets default to a private scope rather than broad visibility.

**Given** an admin updates ownership, team visibility, or ACL principals for an asset
**When** the change is saved
**Then** the authoritative asset access record is updated immediately
**And** subsequent retrieval, citation, preview, and source-open decisions use the new permission state.

**Given** access to an asset is narrowed after it was previously visible
**When** users query the assistant
**Then** newly unauthorized users no longer receive results, snippets, citations, or preview data from that asset
**And** the change is reflected without requiring exposure of stale cached metadata.

**Given** a permission change occurs while embeddings or indexing metadata lag behind
**When** retrieval runs
**Then** ACL evaluation still prevents unauthorized access
**And** permission safety takes precedence over index freshness.

### Story 2.5: Deliver Mixed-Media Search, Preview, and Source Actions

As an authenticated user,
I want one assistant experience across entries, PDFs, docs, and images,
So that I can discover and inspect knowledge regardless of source format.

**FRs implemented:** FR11, FR12, FR13, FR29

**Acceptance Criteria:**

**Given** a user submits a query after mixed-media assets are indexed
**When** results are returned
**Then** the assistant can rank and display entries, PDFs, docs, and images in one result set
**And** each result includes the correct content-type badge, metadata, and snippet style.

**Given** a result is selected for preview
**When** the evidence rail or preview surface opens
**Then** entries show body excerpts, PDFs show page-based excerpts, documents show section excerpts, and images show OCR-backed text or thumbnail context
**And** each preview remains permission-safe.

**Given** a user has access to a result source
**When** they choose `Open source` or `Download`
**Then** the assistant uses authenticated source-open flows or download proxies
**And** those actions are shown only when meaningful and allowed.

**Given** a user does not have access to a source
**When** results and previews are rendered
**Then** the source is omitted entirely rather than shown as a disabled teaser
**And** no hidden-document counts are implied.

### Story 2.6: Reflect Source Lifecycle Status and Content Refresh in the Assistant

As an admin or authenticated user,
I want uploaded sources to show accurate readiness and refresh behavior,
So that I know when new knowledge is available and whether it has changed.

**FRs implemented:** FR30, FR31

**Acceptance Criteria:**

**Given** a source is newly uploaded or reprocessed
**When** its job state changes
**Then** the asset lifecycle moves through statuses such as `processing`, `ready`, or `failed`
**And** those states are surfaced to permitted users in the assistant UI.

**Given** an indexed source is replaced or updated
**When** the refresh flow runs
**Then** the system creates or updates the corresponding asset version and searchable chunks
**And** future retrieval uses the latest ready version.

**Given** a source is still processing
**When** a user encounters it in a relevant context
**Then** the assistant shows a status-aware explanation that the source may not yet appear in answers
**And** it does not present unfinished content as grounded evidence.

**Given** a source refresh has not finished successfully
**When** retrieval or preview occurs
**Then** the assistant continues to behave safely using only ready evidence
**And** status messaging makes the incomplete processing state clear.

## Epic 3: Give Admins and Operators Control Over Knowledge Readiness and Trust

Admins and operators can monitor indexed asset readiness, retry or reindex failed sources, and investigate retrieval, citation, and permission issues with enough traceability to explain assistant behavior.

### Story 3.1: Show Indexed Asset Readiness and Job Status to Privileged Users

As an admin or operator,
I want to see whether knowledge assets are ready for retrieval,
So that I can quickly understand whether missing answers are caused by indexing state.

**FRs implemented:** FR32

**Acceptance Criteria:**

**Given** a privileged user opens the knowledge management surface or privileged assistant status view
**When** indexed assets are loaded
**Then** the user can see each asset’s current readiness state, source type, and latest processing outcome
**And** non-privileged users do not receive this privileged operational view.

**Given** knowledge jobs exist for uploads, extraction, indexing, or refresh work
**When** the user inspects asset details
**Then** the latest job state, timestamps, and failure summary are visible
**And** the UI distinguishes `queued`, `running`, `succeeded`, `failed`, and `dead_letter` states.

**Given** an asset is not yet searchable
**When** the user reviews its status
**Then** the surface makes it clear whether the issue is pending processing, active indexing, or terminal failure
**And** the explanation does not require database-level investigation.

**Given** the system records asset and job events
**When** privileged data is requested
**Then** the API returns named payloads with auditable status information
**And** the response excludes source data the viewer is not authorized to inspect.

### Story 3.2: Allow Safe Retry and Reindex Actions for Failed or Stale Sources

As an admin,
I want to retry failed processing and reindex stale sources,
So that I can restore knowledge availability without recreating assets from scratch.

**FRs implemented:** FR33

**Acceptance Criteria:**

**Given** an asset is in a failed or stale state
**When** an authorized admin triggers retry or reindex
**Then** the API enqueues a new idempotent job for that asset
**And** the prior asset record remains intact for traceability.

**Given** a retry or reindex request is submitted
**When** the job is accepted
**Then** the user receives confirmation that reprocessing has started
**And** the asset/job status reflects the new queued work.

**Given** a retry action is triggered multiple times
**When** the queue processes the request
**Then** duplicate work is handled safely through idempotent job logic or deduplication rules
**And** the system does not create conflicting ready versions.

**Given** a retry or reindex action is executed
**When** the operation is recorded
**Then** the system stores who initiated it and when
**And** the action is available to authorized operators for audit review.

### Story 3.3: Diagnose Retrieval, Permission, and Citation Problems

As an operator,
I want to inspect why a user could not find a source or received an unexpected answer,
So that I can explain and resolve trust issues with evidence.

**FRs implemented:** FR34

**Acceptance Criteria:**

**Given** an operator investigates a reported assistant issue
**When** they review the relevant request or asset path
**Then** they can distinguish whether the problem came from retrieval quality, missing ingestion, permission enforcement, or provider failure
**And** the system presents those categories clearly.

**Given** a user reports that a document should have appeared in search
**When** the operator inspects the asset and request context
**Then** they can see whether the source was indexed, ready, excluded by ACL, or filtered out by query constraints
**And** they do not need to infer the outcome from raw logs alone.

**Given** a user reports that the assistant cited the wrong source
**When** the operator reviews the answer trace
**Then** they can see which evidence chunks were selected and how they mapped to the final citation set
**And** they can determine whether the issue is ranking, citation assembly, or source freshness.

**Given** an operator does not have permission to reveal certain content broadly
**When** they use the diagnostics surface
**Then** the tooling still respects access boundaries for ordinary users
**And** privileged inspection capabilities remain limited to authorized roles.

### Story 3.4: Expose Citation-to-Source Traceability for Investigated Answers

As an operator,
I want a trace from assistant answer to source evidence,
So that I can validate or challenge what the assistant used to support a response.

**FRs implemented:** FR19

**Acceptance Criteria:**

**Given** an answer or investigated request is selected
**When** the operator opens its trace view
**Then** the system shows the supporting source list, citation labels, chunk identifiers, and locators such as page or section
**And** each citation can be traced back to the underlying asset version.

**Given** a cited source has been reprocessed or superseded
**When** the operator reviews a past answer
**Then** the trace still identifies the version that originally supported the response
**And** version history is preserved well enough for investigation.

**Given** citation traceability data is requested
**When** the API responds
**Then** it returns stable machine-readable identifiers alongside human-readable labels
**And** the data supports both UI investigation and future automated evaluation.

**Given** a trace cannot be completed because upstream data is missing or corrupted
**When** the operator inspects the answer
**Then** the system flags the traceability gap explicitly
**And** the issue is treated as an operational defect rather than silently ignored.

## Epic 4: Add Conversation Memory and Quality Feedback Loops

Returning users can reopen trusted conversations with preserved evidence, while product and operations teams can review usage, citation coverage, no-answer behavior, and ingestion signals to improve the assistant over time.

### Story 4.1: Persist Assistant Threads and Message History

As an authenticated Nerve user,
I want my assistant conversations to be saved,
So that I can return to prior research without starting over.

**FRs implemented:** FR36

**Acceptance Criteria:**

**Given** thread persistence is enabled for the later-phase rollout
**When** a user starts and continues a conversation
**Then** the system stores the thread and its messages using dedicated assistant persistence records
**And** the stored data remains associated with the authenticated user and authorized access scope.

**Given** a user starts a new conversation
**When** the new thread is created
**Then** it is persisted separately from prior threads
**And** the existing `New conversation` action still resets the active workspace cleanly.

**Given** a thread contains answers, searches, or no-answer turns
**When** those messages are stored
**Then** the persisted record keeps enough response metadata to render the conversation faithfully later
**And** persistence does not require adding assistant state to `/api/bootstrap`.

**Given** thread persistence is unavailable or fails
**When** a user continues using the assistant
**Then** the assistant can still operate in the current session
**And** the failure is surfaced as a persistence issue rather than as a retrieval failure.

### Story 4.2: Reopen Prior Conversations with Preserved Citation Context

As an authenticated Nerve user,
I want to reopen a previous assistant thread with its citations intact,
So that I can continue a trusted line of inquiry and still verify earlier answers.

**FRs implemented:** FR37, FR38

**Acceptance Criteria:**

**Given** a user has saved assistant threads
**When** they open the thread list
**Then** they can see prior conversations with concise identifying metadata such as title, last query, or time
**And** the UI avoids auto-opening old threads unexpectedly.

**Given** a user reopens a saved conversation
**When** the thread is loaded
**Then** prior messages render in their original order with the associated answer/search/no-answer structure
**And** saved citations remain attached to the answers they originally supported.

**Given** a user inspects a citation from a reopened thread
**When** the evidence rail or trace view opens
**Then** the assistant can still reference the historical citation metadata and source identifiers
**And** the user can distinguish past evidence from newly generated follow-up turns.

**Given** a historical source has since changed permissions or been superseded
**When** an old thread is reopened
**Then** the system preserves the historical citation record for auditability
**And** current source-open actions still respect present-day authorization rules.

### Story 4.3: Expose Usage and Trust Signals for Continuous Improvement

As a product owner or operator,
I want to review how the assistant is being used and trusted,
So that I can prioritize relevance, usability, and rollout improvements.

**FRs implemented:** FR35

**Acceptance Criteria:**

**Given** assistant telemetry has been collected over time
**When** an authorized reviewer opens the quality insights surface
**Then** they can inspect usage trends, source-open activity, citation coverage, no-answer rates, and ingestion-related signals
**And** those signals are grouped in a way that supports product decision-making.

**Given** answer and search behavior both contribute to trust
**When** the reviewer analyzes quality metrics
**Then** they can distinguish search usage from grounded-answer usage
**And** they can correlate follow-up actions such as citation clicks or source opens.

**Given** usage and trust metrics are presented
**When** the reviewer filters by time or rollout phase
**Then** they can compare changes across releases or corpus expansions
**And** the data remains scoped to authorized roles.

**Given** the system records model and ingestion costs
**When** quality signals are reviewed
**Then** usage and trust outcomes can be interpreted alongside operating cost indicators
**And** the surface supports informed tuning decisions rather than raw prompt counting alone.

### Story 4.4: Support Evaluation and Quality Review with Persisted Answer Evidence

As an operator or product stakeholder,
I want stored answers to retain enough evidence context for later review,
So that quality investigations and evaluation can be performed against real assistant behavior.

**FRs implemented:** FR35, FR38

**Acceptance Criteria:**

**Given** an assistant answer is persisted
**When** it is saved to history
**Then** the system stores the citation set and supporting identifiers alongside the answer
**And** later reviewers can inspect what evidence the answer used at the time it was generated.

**Given** a reviewer examines historical assistant behavior
**When** they compare answers across threads or periods
**Then** they can assess citation coverage, abstention behavior, and source usage using persisted evidence data
**And** the records support both manual review and future automated evaluation workflows.

**Given** a persisted answer lacks citation data or has incomplete evidence references
**When** it is reviewed
**Then** the system flags that record as incomplete
**And** the gap is visible as a quality issue rather than silently ignored.

**Given** later-phase evaluation runs are performed
**When** historical stored answers are sampled
**Then** reviewers can validate whether the assistant remained grounded over time
**And** persisted answer evidence provides a stable basis for that review.
