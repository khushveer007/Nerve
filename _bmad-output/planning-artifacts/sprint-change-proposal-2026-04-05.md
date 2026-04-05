---
date: 2026-04-05
project: Nerve
mode: batch
status: applied
sourceReport: /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-05.md
assumptions:
  - The implementation-readiness report is the change trigger and evidence package for this course-correction pass.
  - Batch mode is appropriate because the request referenced an existing report rather than asking for an interactive refinement loop.
  - No implementation rollback is required because the issues were discovered at planning/readiness time rather than after coded delivery.
affectedArtifacts:
  - /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md
  - /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/ux-design-specification.md
  - /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/prd.md
  - /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/architecture.md
---

# Sprint Change Proposal

**Project:** Nerve  
**Date:** 2026-04-05  
**Prepared via:** `bmad-correct-course`  
**Mode:** Batch  
**Trigger:** Readiness findings from [implementation-readiness-report-2026-04-05.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-05.md)

## 1. Issue Summary

The planning set is close to implementation-ready, but the readiness assessment surfaced a cluster of scope and sequencing defects that should be corrected before sprint planning or story execution begins.

The most important trigger is the Epic 3 sequencing defect: Story 3.3 currently promises citation-trace diagnostics that are only introduced in Story 3.4. The report also identified a wider scope-drift pattern:

- Epic 1 Story 1.2 does not yet prove user-visible Phase 1 value.
- Epic 1 Story 1.4 is oversized and mixes retrieval logic, filters, and result-list UX.
- Epic 2 Story 2.5 is oversized and mixes mixed-media rendering with source-open/download behavior.
- Epic 4 mixes two different value streams: conversation memory and product/operations quality review.
- The UX specification treats mixed-media support and upload flows as launch behavior even though the PRD and architecture define Phase 1 as entry-only.
- The UX specification targets `WCAG 2.2 AA`, while the PRD and architecture specify `WCAG 2.1 AA`.

If these issues are left unresolved, the backlog will look more complete than it really is, QA acceptance will target the wrong launch surface, and story sequencing will produce avoidable rework.

## 2. Impact Analysis

### Epic Impact

- **Epic 1** remains viable, but its Phase 1 story boundaries need tightening so the first release is clearly entry-backed and testable.
- **Epic 2** remains viable, but Story 2.5 should be split so mixed-media rendering and authenticated source actions can be estimated and delivered independently.
- **Epic 3** remains viable, but Story 3.3 must be narrowed or resequenced to remove the forward dependency on Story 3.4.
- **Epic 4** should be restructured because it combines end-user conversation memory with internal quality-review capabilities that do not form one cohesive user-value theme.
- A **new Epic 5** is recommended so quality insights and reviewable answer evidence have their own backlog lane.

### Artifact Conflicts

- **PRD:** Largely authoritative already. The main issue is traceability, not product intent. The MVP and explicit deferrals are clear, but a small note would help readers understand that the FR inventory spans multiple phases.
- **Architecture:** Already aligned with an entry-only Phase 1, Phase 2 mixed-media ingestion, and later saved history/analytics. No blocking architecture rewrite is required.
- **UX Design:** Requires the largest correction because launch examples, supported source types, filters, upload flow placement, and accessibility target are not aligned to the Phase 1 contract.
- **Epics:** Require the most direct backlog surgery because sizing, sequencing, and epic grouping issues live here.

### Technical and Delivery Impact

- Current estimates for Stories 1.4 and 2.5 are likely inflated by bundled concerns.
- QA and readiness checks cannot be trusted until the launch contract explicitly says Phase 1 is entry-only.
- Accessibility testing scope remains unstable until one target standard is selected and repeated consistently.
- Dev handoff will be cleaner after story splits because retrieval/ranking, result UX, preview behavior, and source actions can be validated separately.

## 3. Checklist Execution Summary

| Item | Status | Notes |
| --- | --- | --- |
| 1.1 Triggering story identified | [x] Done | Story 3.3 first exposed the sequencing defect; the readiness report then identified related story and scope issues across Stories 1.2, 1.4, 2.5 and Epic 4. |
| 1.2 Core problem defined | [x] Done | Primary issue type: misunderstanding of phased requirements and over-compressed story scopes. |
| 1.3 Evidence gathered | [x] Done | Evidence comes from the readiness report plus direct review of `epics.md`, `ux-design-specification.md`, `prd.md`, and `architecture.md`. |
| 2.1 Current epic assessed | [x] Done | Affected epics can still ship with modification; none need to be discarded. |
| 2.2 Epic-level changes determined | [x] Done | Epic 4 split recommended; Epic 1 and Epic 2 story splits recommended; Epic 3 sequencing fix required. |
| 2.3 Remaining epics reviewed | [x] Done | Future epics remain valid once phase boundaries and story dependencies are clarified. |
| 2.4 New/obsolete epic check | [x] Done | Add a new Epic 5 for quality insights and reviewable answer evidence; no epic is obsolete. |
| 2.5 Epic order and priority reviewed | [x] Done | Keep Phase 1 entry-only work first; ensure citation traceability precedes deep citation diagnostics. |
| 3.1 PRD conflict review | [x] Done | No core-goal conflict; add one scope-traceability clarification note. |
| 3.2 Architecture conflict review | [x] Done | Architecture already matches the intended phased rollout; no major text change required. |
| 3.3 UX conflict review | [x] Done | Launch examples, acceptance, facets, uploads, and accessibility target need revision. |
| 3.4 Other artifact impact review | [x] Done | Sprint planning, QA acceptance, and implementation readiness must be rerun after artifact updates. |
| 4.1 Direct adjustment evaluated | [x] Done | Viable. Effort: Medium. Risk: Low-Medium. |
| 4.2 Potential rollback evaluated | [x] Done | Not viable or needed. No implementation rollback exists to simplify this problem. |
| 4.3 PRD MVP review evaluated | [x] Done | Partially viable. Use a small clarification, not a fundamental MVP reduction. Effort: Low. Risk: Low. |
| 4.4 Recommended path selected | [x] Done | Hybrid: direct artifact adjustment plus a small PRD traceability clarification. |
| 5.1 Issue summary created | [x] Done | Included in this proposal. |
| 5.2 Epic and artifact impact documented | [x] Done | Included in Sections 2 and 5. |
| 5.3 Recommended path documented | [x] Done | Included in Section 4. |
| 5.4 MVP impact and action plan defined | [x] Done | Included in Sections 4 and 6. |
| 5.5 Agent handoff plan established | [x] Done | Included in Section 7. |
| 6.1 Final checklist review | [!] Action-needed | Becomes complete after approved edits are applied and readiness is rerun. |
| 6.2 Proposal accuracy verification | [!] Action-needed | Confirm after backlog edits are merged and terminology stays consistent across docs. |

## 4. Recommended Approach

### Selected Path

**Hybrid of Option 1 (Direct Adjustment) and a light Option 3 (PRD MVP traceability clarification).**

### Why This Path

- The PRD and architecture already define the right product direction. The issue is mostly backlog and UX alignment, not a broken product strategy.
- There is no implementation rollback to gain value from, so rollback would create churn without reducing risk.
- A focused document pass can remove the sequencing defect, improve story sizing, and make the launch contract testable without changing the MVP itself.

### Effort, Risk, and Timeline Impact

- **Effort:** Medium
- **Risk:** Medium before correction, Low-Medium after correction
- **Timeline impact:** Small planning delay now to avoid larger execution and QA churn later

### Recommended Delivery Shape

1. Update `epics.md` to fix sequencing, split oversized stories, and separate Epic 4 into two value streams.
2. Update `ux-design-specification.md` so launch behavior, example copy, facets, and acceptance criteria describe the same entry-only Phase 1 as the PRD and architecture.
3. Add one clarifying note to `prd.md` so readers do not confuse the full FR inventory with Phase 1 launch criteria.
4. Re-run implementation readiness before sprint planning.

## 5. Detailed Change Proposals

### A. `epics.md`

#### Change 1: Make Story 1.2 prove visible Phase 1 value

**Story:** 1.2  
**Section:** Acceptance Criteria

**OLD**

```md
**Given** existing Nerve entries are present
**When** the entry indexing flow runs
**Then** each eligible entry is represented as a knowledge asset with versioned chunked content and citation locator metadata
**And** entry metadata needed for ranking and filtering is preserved.

**Given** Phase 1 is active
**When** assistant queries run
**Then** the searchable corpus is limited to existing entry-backed knowledge
**And** no file, PDF, or image upload content is referenced yet.
```

**NEW**

```md
**Given** existing Nerve entries are present
**When** the entry indexing flow runs
**Then** each eligible entry is represented as a knowledge asset with versioned chunked content and citation locator metadata
**And** entry metadata needed for ranking and filtering is preserved.

**Given** Phase 1 is active
**When** assistant queries run
**Then** the searchable corpus is limited to existing entry-backed knowledge
**And** no file, PDF, or image upload content is referenced yet.

**Given** indexed entry content is available
**When** an authenticated user submits a known-item or discovery query for that content
**Then** the assistant can return at least one accessible entry-backed result from the indexed corpus
**And** the result is identifiable as Phase 1 entry content rather than a later mixed-media source type.
```

**Rationale:** Story 1.2 currently reads like infrastructure only. This addition makes the story testable as user-facing value without pulling in later preview or open-source behavior.

#### Change 2: Split Story 1.4 into retrieval logic and filtered-result UX

**Story:** 1.4  
**Section:** Title, scope, and acceptance criteria

**OLD**

```md
### Story 1.4: Add Hybrid Search, Intent Routing, and Filtered Result Lists
```

```md
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
```

**NEW**

```md
### Story 1.4: Add Hybrid Search and Intent Routing for Entry Queries
```

```md
**Given** a user submits a known-item or discovery query in `Search` mode or `Auto` mode
**When** the request is processed
**Then** the assistant returns a search-style response with ranked entry results
**And** ranking combines semantic similarity, exact match behavior, and metadata-aware retrieval.

**Given** the query intent is ambiguous
**When** the request is processed in `Auto` mode
**Then** the system chooses search-style or answer-style behavior using server-side routing rules
**And** the response shape remains explainable from the returned evidence.

**Given** no accessible entries match the request
**When** the response is returned
**Then** the assistant shows a neutral no-results state with refinement suggestions
**And** the user can retry without retyping the original query.
```

```md
### Story 1.4a: Add Filtered Entry Result Lists and Phase 1 Facets

As an authenticated Nerve user,
I want to narrow entry-backed results with visible filters,
So that I can refine discovery without leaving the assistant workflow.

**FRs implemented:** FR4, FR10, FR12

**Acceptance Criteria:**

**Given** a user applies supported Phase 1 filters such as department, date range, or sort
**When** a query is submitted
**Then** the API applies those filters to retrieval and ranking
**And** active filters remain visible as removable chips across turns until cleared.

**Given** privileged entry metadata is available and the user's role permits it
**When** filter controls are shown
**Then** optional facets such as team, owner, and visibility scope may appear
**And** later-phase facets such as indexing status are not treated as Phase 1 requirements.

**Given** more than five accessible results are found
**When** the result group is displayed
**Then** the page shows a summary row with result count and active facets
**And** the UI initially renders five results with a `Show more results` control.
```

**Rationale:** This keeps retrieval and intent logic separate from result refinement and display behavior, and it makes the phase boundary around filters explicit.

#### Change 3: Split Story 2.5 into mixed-media rendering and source actions

**Story:** 2.5  
**Section:** Title, scope, and acceptance criteria

**OLD**

```md
### Story 2.5: Deliver Mixed-Media Search, Preview, and Source Actions
```

```md
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
```

**NEW**

```md
### Story 2.5: Deliver Mixed-Media Search and Preview
```

```md
**Given** a user submits a query after mixed-media assets are indexed
**When** results are returned
**Then** the assistant can rank and display entries, PDFs, docs, and images in one result set
**And** each result includes the correct content-type badge, metadata, and snippet style.

**Given** a result is selected for preview
**When** the evidence rail or preview surface opens
**Then** entries show body excerpts, PDFs show page-based excerpts, documents show section excerpts, and images show OCR-backed text or thumbnail context
**And** each preview remains permission-safe.

**Given** a user does not have access to a source
**When** results and previews are rendered
**Then** the source is omitted entirely rather than shown as a disabled teaser
**And** no hidden-document counts are implied.
```

```md
### Story 2.5a: Deliver Authenticated Mixed-Media Source Open and Download Actions

As an authenticated user,
I want permitted mixed-media sources to open through trusted in-app flows,
So that I can inspect the original source without breaking access control.

**FRs implemented:** FR13

**Acceptance Criteria:**

**Given** a user has access to a result source
**When** they choose `Open source` or `Download`
**Then** the assistant uses authenticated source-open flows or download proxies
**And** those actions are shown only when meaningful and allowed.

**Given** a source action is not allowed for the current user or asset type
**When** result actions are rendered
**Then** the unavailable action is omitted rather than teased
**And** no protected source details are leaked.
```

**Rationale:** Rendering mixed-media results is already substantial. Splitting source-open behavior creates cleaner estimation and testing boundaries.

#### Change 4: Remove the Story 3.3 forward dependency on Story 3.4

**Story:** 3.3  
**Section:** Acceptance Criteria

**OLD**

```md
**Given** a user reports that the assistant cited the wrong source
**When** the operator reviews the answer trace
**Then** they can see which evidence chunks were selected and how they mapped to the final citation set
**And** they can determine whether the issue is ranking, citation assembly, or source freshness.
```

**NEW**

```md
**Given** a user reports that the assistant cited the wrong source
**When** the operator reviews the diagnostic record
**Then** they can determine whether the issue most likely came from ranking, citation assembly, source freshness, or missing trace data
**And** the system clearly indicates when deeper citation-to-source trace inspection requires Story 3.4 capabilities.
```

**Rationale:** Story 3.3 should stop at categorizing the problem. Detailed citation-to-source trace inspection belongs in Story 3.4.

#### Change 5: Split Epic 4 into conversation memory and quality insights

**Epic:** 4  
**Section:** Epic title, summary, and story grouping

**OLD**

```md
## Epic 4: Add Conversation Memory and Quality Feedback Loops

Returning users can reopen trusted conversations with preserved evidence, while product and operations teams can review usage, citation coverage, no-answer behavior, and ingestion signals to improve the assistant over time.
```

**NEW**

```md
## Epic 4: Add Conversation Memory and Historical Citation Continuity

Returning users can reopen trusted conversations with preserved evidence and citation context so they can continue prior research without losing trust.
```

```md
## Epic 5: Add Quality Insights and Reviewable Answer Evidence

Product and operations teams can review usage, citation coverage, no-answer behavior, ingestion signals, and persisted answer evidence so they can improve the assistant over time.
```

**Recommended regrouping**

- Keep in **Epic 4**:
  - Story 4.1 Persist Assistant Threads and Message History
  - Story 4.2 Reopen Prior Conversations with Preserved Citation Context
- Move to **Epic 5**:
  - Story 5.1 Expose Usage and Trust Signals for Continuous Improvement (former 4.3)
  - Story 5.2 Support Evaluation and Quality Review with Persisted Answer Evidence (former 4.4)

**Rationale:** Conversation memory is an end-user continuity theme. Quality dashboards and evidence review are an internal operational/product theme. Keeping them together obscures priority and ownership.

### B. `ux-design-specification.md`

#### Change 6: Reframe launch behavior as entry-only and move mixed-media/upload behaviors to later phases

**Section:** Primary Flows, Result Presentation, Filters, and Launch Acceptance

**OLD**

```md
The page should show ... starter chips such as `Find a policy PDF`, `Summarize attendance guidance`, `Show recent admissions documents`, and `What do the documents say about placement updates?`
```

```md
The user asks something like `find the PDF about attendance` or `show documents related to admissions`.
```

```md
### 6. Upload And Indexing Flow
For permitted roles, the page header includes `Add source`.
```

```md
- Source cards support entries, PDFs, docs, and images.
```

```md
- Content type: `Entry`, `PDF`, `Doc`, `Image`
- Indexing status: `Processing`, `Ready`, `Failed`
```

**NEW**

```md
The page should show ... starter chips such as `Find the attendance guidance entry`, `Summarize attendance guidance`, `Show recent admissions entries`, and `What does Nerve say about placement updates?`
```

```md
The user asks something like `find the attendance guidance entry` or `show admissions entries related to scholarship deadlines`.
```

```md
### 6. Future Upload And Indexing Flow (Phase 2+)
For permitted roles, a later-phase assistant or management surface may include `Add source`, upload status, and source processing visibility. These capabilities are not part of Phase 1 launch acceptance.
```

```md
### Recommended Facets

Phase 1:
- Department
- Date range
- Sort: `Relevance` by default, optional `Newest`

Phase 2+:
- Content type: `Entry`, `PDF`, `Doc`, `Image`
- Indexing status: `Processing`, `Ready`, `Failed`

Privileged Phase 1 facets when entry metadata makes them meaningful:
- Team
- Owner
- Visibility scope
```

```md
## Launch Acceptance Checklist

- The page still lives at `/ai/query` and fits inside the existing Nerve shell.
- `Auto`, `Search`, and `Ask` are understandable without documentation.
- Search-style and answer-style responses feel distinct and intentional.
- Every substantive answer includes clickable citations.
- Evidence can be inspected without leaving the page.
- No-evidence and low-confidence states are explicit and useful.
- Source cards support Phase 1 entry-backed results.
- Mobile users can query, filter, inspect evidence, and open entry sources without layout breakage.
- Blocked content is never revealed through source names, snippets, counts, or citation labels.

### Post-MVP Acceptance Additions

- Source cards support PDFs, docs, and images.
- Privileged upload and indexing flows surface processing state clearly.
- Mixed-media facets and indexing-status facets are available where relevant.
```

**Rationale:** The UX spec currently describes a richer launch than the PRD and architecture allow. This rewrite keeps the design ambitious while making the launch gate honest.

#### Change 7: Align accessibility target with the authoritative product documents

**Section:** Accessibility

**OLD**

```md
- Target WCAG 2.2 AA.
```

**NEW**

```md
- Target WCAG 2.1 AA for Phase 1 launch, matching the PRD and architecture.
- Track WCAG 2.2 AA improvements as follow-on usability enhancements after launch alignment is achieved.
```

**Rationale:** One accessibility target must drive design, QA, and implementation. The PRD and architecture already use `WCAG 2.1 AA`, so the UX spec should match unless leadership explicitly changes the standard everywhere.

### C. `prd.md`

#### Change 8: Add one scope-traceability note so the FR inventory is not mistaken for the Phase 1 launch gate

**Section:** `MVP Feature Set (Phase 1)` or immediately before the FR inventory

**OLD**

```md
### MVP Feature Set (Phase 1)
```

**NEW**

```md
### MVP Feature Set (Phase 1)

The functional requirement inventory in this document describes the full planned assistant capability set across phases. Implementation readiness for Phase 1 is judged against this MVP feature set and its explicit deferrals; later-phase requirements such as mixed-media ingestion, saved history, and advanced quality-review tooling are not Phase 1 blockers.
```

**Rationale:** The PRD already says the right thing, but adding this sentence will reduce repeated confusion during backlog validation and future readiness checks.

### D. `architecture.md`

#### Change 9: No blocking architecture rewrite required

**Assessment**

- The architecture already states:
  - Phase 1 is entry-only
  - Phase 2 adds private uploads and OCR/extraction
  - Phase 3 adds asset governance and operational tooling
  - Later phases add saved threads, analytics, and tuning
- No architecture text change is required to proceed with this course correction.

**Optional follow-up**

- After epic restructuring, add a short cross-reference in the implementation sequence or epic-traceability section if the team wants the new Epic 5 reflected explicitly.

## 6. MVP Impact and Action Plan

### MVP Impact

The MVP itself does **not** need to be reduced. This proposal protects the existing Phase 1 MVP by removing accidental launch inflation from the UX and backlog artifacts.

### High-Level Action Plan

1. Apply the `epics.md` changes first so story sequencing and sizing are stable.
2. Apply the `ux-design-specification.md` changes next so design acceptance matches the revised backlog.
3. Add the PRD clarification note.
4. Confirm the accessibility standard remains `WCAG 2.1 AA` across all planning artifacts.
5. Re-run `bmad-check-implementation-readiness`.
6. Proceed to `bmad-sprint-planning` only after the revised artifacts pass readiness.

### Dependencies and Sequencing

- Story 3.4 traceability must exist before any diagnostic story depends on citation-to-source mapping.
- Phase 1 launch acceptance must stay entry-only until Epic 2 mixed-media work is planned and approved.
- Epic 5 quality insights should be sequenced after the event and persistence foundations from Epics 3 and 4 are available.

## 7. Implementation Handoff

### Scope Classification

**Moderate**

This is not a fundamental product reset, but it does require backlog reorganization, document edits, and a readiness re-check before implementation should start.

### Handoff Recipients

- **Product Owner / Scrum Master**
  - Update `epics.md`
  - Split oversized stories
  - Remove the Story 3.3 forward dependency
  - Introduce Epic 5 and resequence backlog priorities
- **UX Designer**
  - Revise launch examples, flows, and acceptance criteria in `ux-design-specification.md`
  - Separate Phase 1 and post-MVP UX behaviors
  - Align accessibility target to the agreed product standard
- **Product Manager / Architect**
  - Confirm that `WCAG 2.1 AA` remains the authoritative target
  - Approve the small PRD clarification note
  - Decide whether the architecture should explicitly mention the new Epic 5 grouping
- **Development / QA**
  - Re-estimate split stories
  - Re-run implementation readiness after artifact changes
  - Use the revised Phase 1 launch contract for implementation and acceptance planning

### Success Criteria

- No story depends on a capability introduced later in the backlog.
- Phase 1 launch language is entry-only in epics, UX, PRD, and architecture.
- Accessibility target is consistent across planning artifacts.
- Epic groupings reflect one coherent user or business value stream each.
- Readiness can be rerun without re-raising the same scope and sequencing findings.

## 8. Proposed Workflow Summary

- **Issue addressed:** planning misalignment across epic sequencing, story sizing, UX launch scope, and accessibility target
- **Recommended change scope:** Moderate
- **Artifacts to modify:** `epics.md`, `ux-design-specification.md`, `prd.md`
- **Artifacts reviewed but not blocked:** `architecture.md`
- **Route after approval:** Product Owner / Scrum Master + UX Designer, with PM/Architect signoff on the accessibility target and PRD clarification
