---
date: 2026-04-05
project: Nerve
mode: batch
status: applied
changeTrigger: Planning-readiness defects identified in implementation-readiness-report-2026-04-05.md
sourceReport: /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-05.md
scopeClassification: moderate
approvedBy: Opsa
approvedOn: 2026-04-05
appliedOn: 2026-04-05
assumptions:
  - The readiness report dated 2026-04-05 is the agreed trigger and evidence package for this course-correction pass.
  - The defects were found before implementation started, so no rollback of coded work is required.
  - The PRD, architecture, and UX specification remain directionally valid; the main corrections are in backlog structure and story acceptance criteria.
affectedArtifacts:
  - /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md
  - /home/opsa/Work/Nerve/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-05.md
---

# Sprint Change Proposal

**Project:** Nerve  
**Date:** 2026-04-05  
**Prepared via:** `bmad-correct-course`  
**Mode:** Batch  
**Trigger:** Readiness findings from [implementation-readiness-report-2026-04-05.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-05.md)

## 1. Issue Summary

The project does not need a product-direction reset. It needs a backlog-structure correction before sprint planning begins.

The trigger is the readiness assessment finding that [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md) contains one explicit forward dependency plus several planning-hygiene defects:

- Story 3.3 depends on future Story 3.4 behavior, which breaks the rule that stories must be independently completable in sequence.
- Epic 2's FR summary and FR coverage map do not match the actual story-level ownership of FR12 and FR13.
- Some approved UX requirements are documented in the requirements inventory but not carried into testable story acceptance criteria.
- Story 1.7 bundles telemetry, evaluation, and rollout-governance work into one story that is larger than the intended single-dev-agent scope.

These issues were discovered during implementation-readiness review, not during coding. That means the safest correction is to fix the planning artifacts now, then rerun readiness before sprint planning or implementation.

## 2. Impact Analysis

### Epic Impact

- **Epic 1** remains valid and retains the same user-value outcome. It needs acceptance-criteria additions for UX traceability and one story split so rollout guardrails are easier to implement and test.
- **Epic 2** remains valid and does not need resequencing. It needs traceability cleanup so the epic summary and FR coverage map reflect the mixed-media story set already written.
- **Epic 3** remains valid, but Story 3.3 must be narrowed so it no longer references future Story 3.4 capability.
- **Epic 4** and **Epic 5** remain valid and are not directly changed by this proposal.

### Story Impact

- **Story 1.1** needs acceptance criteria for the sidebar label rename and accessible status announcements.
- **Story 1.4a** needs explicit `Clear all` filter behavior in acceptance criteria.
- **Story 1.6** needs an explicit accessibility criterion for touch-target sizing on citation and evidence actions.
- **Story 1.7** should be split into a telemetry story and an evaluation/launch-guardrails story.
- **Story 2.5** needs an accessibility criterion for image/OCR-backed text alternatives.
- **Story 3.3** needs its diagnostic scope narrowed to remove the forward dependency on Story 3.4.

### Artifact Conflicts

- **PRD:** No direct text change required. The PRD already defines the product boundary and phased scope clearly enough.
- **Architecture:** No direct text change required. The architecture already supports the intended phased rollout and does not create the dependency or traceability defects.
- **UX Design:** No direct text change required. The UX spec already contains the missing requirements; the problem is that those requirements were not translated into story-level acceptance criteria.
- **Epics:** Direct edits are required. This is the artifact where the actionable correction belongs.

### Technical and Delivery Impact

- Sprint planning should wait until the epic/story corrections are applied.
- Implementation estimates for Epic 1 become more reliable after Story 1.7 is split.
- QA acceptance becomes safer after UX requirements move from inventory form into story-level criteria.
- No code, infrastructure, or deployment rollback is required.

## 3. Checklist Execution Summary

| Item | Status | Notes |
| --- | --- | --- |
| 1.1 Triggering story identified | [x] Done | Story 3.3 revealed the forward dependency, with related readiness defects in Epic 1 and Epic 2. |
| 1.2 Core problem defined | [x] Done | Issue type: misunderstanding of story sequencing and incomplete planning traceability rather than a product-strategy change. |
| 1.3 Evidence gathered | [x] Done | Evidence comes from the readiness report and direct review of `epics.md`. |
| 2.1 Current epic assessed | [x] Done | Epic 3 is still viable with a narrow Story 3.3 correction. |
| 2.2 Epic-level changes determined | [x] Done | Modify Epic 1, Epic 2, and Epic 3 story definitions; no epic removal or new epic creation required. |
| 2.3 Remaining epics reviewed | [x] Done | Epic 4 and Epic 5 remain valid as written. |
| 2.4 Future epic invalidation/new epic check | [x] Done | No future epic is invalidated, and no new epic is required. |
| 2.5 Epic order/priority reviewed | [x] Done | No epic resequencing required; only within-epic cleanup is needed. |
| 3.1 PRD conflict review | [x] Done | No core PRD conflict found. |
| 3.2 Architecture conflict review | [x] Done | No architecture contradiction found. |
| 3.3 UX conflict review | [x] Done | UX remains valid; acceptance-criteria traceability is the missing link. |
| 3.4 Other artifact impact review | [x] Done | Readiness should be rerun after edits; no sprint-status file was found to update yet. |
| 4.1 Direct adjustment evaluated | [x] Done | Viable. Effort: Medium. Risk: Low. |
| 4.2 Potential rollback evaluated | [x] Done | Not viable. No implementation rollback is needed. |
| 4.3 PRD MVP review evaluated | [x] Done | Not viable as the primary path. MVP remains achievable without reducing scope. |
| 4.4 Recommended path selected | [x] Done | Option 1: Direct Adjustment. |
| 5.1 Issue summary created | [x] Done | Included in Section 1. |
| 5.2 Epic/artifact adjustments documented | [x] Done | Included in Sections 2 and 5. |
| 5.3 Recommended path documented | [x] Done | Included in Section 4. |
| 5.4 MVP impact/action plan defined | [x] Done | Included in Section 6. |
| 5.5 Handoff plan established | [x] Done | Included in Section 7. |
| 6.1 Checklist completion review | [!] Action-needed | Becomes complete after proposal approval and artifact edits. |
| 6.2 Proposal accuracy verification | [!] Action-needed | Final verification happens after your review. |
| 6.3 Explicit user approval | [!] Action-needed | Pending your review. |
| 6.4 Update sprint-status | [N/A] Skip | No `sprint-status.yaml` or `sprint-status.yml` was found in the project. |
| 6.5 Confirm next steps and handoff | [!] Action-needed | Pending your review. |

## 4. Recommended Approach

### Selected Path

**Option 1: Direct Adjustment**

### Rationale

- The product intent is still correct.
- The defects are local to backlog structure, story sizing, and acceptance-criteria traceability.
- Fixing the backlog now is lower-risk and faster than changing the PRD or architecture.
- This path preserves momentum while preventing avoidable implementation churn.

### Effort, Risk, and Timeline Impact

- **Effort:** Medium
- **Risk:** Low
- **Timeline impact:** Small planning delay now to prevent larger implementation and QA churn later

## 5. Detailed Change Proposals

### A. `epics.md`

#### Change 1: Correct Epic 2 FR traceability

**Artifact:** [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md)  
**Sections:** `FR Coverage Map`, `Epic List`

**OLD**

```md
FR12: Epic 1 - Source descriptors, snippets, and content-type indicators
FR13: Epic 1 - Authorized source-open actions from results
```

```md
### Epic 2: Expand the Assistant to Private Files, PDFs, and Images
Admins can add governed knowledge beyond entries, and users can retrieve mixed-media content with the same permission-safe citations, source actions, and status-aware experience.
**FRs covered:** FR11, FR22, FR23, FR24, FR26, FR27, FR28, FR29, FR30, FR31.
```

**NEW**

```md
FR12: Epic 1 and Epic 2 - Source descriptors, snippets, and content-type indicators across entry and mixed-media results
FR13: Epic 1 and Epic 2 - Authorized source-open actions across entry and mixed-media sources
```

```md
### Epic 2: Expand the Assistant to Private Files, PDFs, and Images
Admins can add governed knowledge beyond entries, and users can retrieve mixed-media content with the same permission-safe citations, source actions, and status-aware experience.
**FRs covered:** FR11, FR12, FR13, FR22, FR23, FR24, FR26, FR27, FR28, FR29, FR30, FR31.
```

**Rationale:** Story 2.5 and Story 2.5a already implement FR12 and FR13. The epic summary and FR coverage map should match that actual ownership.

#### Change 2: Remove the forward dependency from Story 3.3

**Artifact:** [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md)  
**Story:** `3.3`  
**Section:** Acceptance Criteria

**OLD**

```md
**Given** a user reports that the assistant cited the wrong source
**When** the operator reviews the diagnostic record
**Then** they can determine whether the issue most likely came from ranking, citation assembly, source freshness, or missing trace data
**And** the system clearly indicates when deeper citation-to-source trace inspection requires Story 3.4 capabilities.
```

**NEW**

```md
**Given** a user reports that the assistant cited the wrong source
**When** the operator reviews the diagnostic record
**Then** they can determine whether the issue most likely came from ranking, citation assembly, source freshness, or missing trace data
**And** the system clearly labels when the available diagnostic record is insufficient for a source-level conclusion.
```

**Rationale:** Story 3.3 should stand on its own as a diagnostics story. Story 3.4 can remain a later traceability enhancement without being required for Story 3.3 completion.

#### Change 3: Add missing UX-DR1 and UX-DR25 traceability to Story 1.1

**Artifact:** [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md)  
**Story:** `1.1`  
**Section:** Acceptance Criteria

**OLD**

```md
**Given** the assistant page is opened for the first time in a session
**When** no query has been submitted yet
**Then** the page shows the `Assistant` title, helper text, `Auto/Search/Ask` mode controls, a sticky composer, and starter prompts
**And** `Auto` is the default selected mode.
```

**NEW**

```md
**Given** the assistant page is opened for the first time in a session
**When** no query has been submitted yet
**Then** the page shows the `Assistant` title, helper text, `Auto/Search/Ask` mode controls, a sticky composer, and starter prompts
**And** `Auto` is the default selected mode.

**Given** the updated assistant route is visible in the main application shell
**When** navigation and page chrome are rendered
**Then** the sidebar label reads `Assistant` while the route remains `/ai/query`
**And** the page continues to use the existing brownfield navigation structure.

**Given** the assistant enters retrieving, generating, no-answer, or error states
**When** the visible status changes
**Then** the page announces the change through an `aria-live` region
**And** screen-reader users receive the same state guidance shown visually.
```

**Rationale:** The UX spec already requires the sidebar rename and accessible state announcements. They need to be made testable in the story.

#### Change 4: Add explicit `Clear all` filter behavior to Story 1.4a

**Artifact:** [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md)  
**Story:** `1.4a`  
**Section:** Acceptance Criteria

**OLD**

```md
**Given** a user applies supported Phase 1 filters such as department, date range, or sort
**When** a query is submitted
**Then** the API applies those filters to retrieval and ranking
**And** active filters remain visible as removable chips across turns until cleared.
```

**NEW**

```md
**Given** a user applies supported Phase 1 filters such as department, date range, or sort
**When** a query is submitted
**Then** the API applies those filters to retrieval and ranking
**And** active filters remain visible as removable chips across turns until cleared.

**Given** one or more filters are active
**When** the user chooses `Clear all`
**Then** the active filter set is removed in one action
**And** the next query runs without the previously applied facets unless the user selects them again.
```

**Rationale:** `Clear all` is a retained UX requirement and should be directly testable.

#### Change 5: Add explicit accessibility acceptance criteria where the UX spec expects them

**Artifact:** [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md)  
**Stories:** `1.6`, `2.5`

**OLD**

```md
**Given** the user navigates citations with keyboard only
**When** citation chips and evidence items receive focus
**Then** focus order remains clear and visible
**And** citation controls expose descriptive accessible names for screen readers.
```

```md
**Given** a result is selected for preview
**When** the evidence rail or preview surface opens
**Then** entries show body excerpts, PDFs show page-based excerpts, documents show section excerpts, and images show OCR-backed text or thumbnail context
**And** each preview remains permission-safe.
```

**NEW**

```md
**Given** the user navigates citations with keyboard only
**When** citation chips and evidence items receive focus
**Then** focus order remains clear and visible
**And** citation controls expose descriptive accessible names for screen readers.

**Given** citation chips or evidence actions are rendered on touch-capable devices
**When** the user interacts with them
**Then** the controls provide a minimum 44 by 44 interaction target
**And** touch affordances do not remove visible focus treatment for keyboard users.
```

```md
**Given** a result is selected for preview
**When** the evidence rail or preview surface opens
**Then** entries show body excerpts, PDFs show page-based excerpts, documents show section excerpts, and images show OCR-backed text or thumbnail context
**And** each preview remains permission-safe.

**Given** an image-backed or OCR-backed preview is displayed
**When** assistive technologies are used
**Then** the preview exposes a text alternative or extracted-text equivalent
**And** users do not need the thumbnail alone to understand the source.
```

**Rationale:** UX-DR25 spans both Phase 1 interaction controls and later mixed-media previews. The story set should carry both pieces explicitly.

#### Change 6: Split oversized Story 1.7 into two stories

**Artifact:** [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md)  
**Story:** `1.7`

**OLD**

```md
### Story 1.7: Add Phase 1 Telemetry, Evaluation, and Rollout Guardrails

As a product owner or operator,
I want launch-quality visibility into assistant quality and failures,
So that the entry-backed rollout can be monitored and trusted in production.

**FRs implemented:** FR14, FR15, FR17, FR20, FR21, FR25
```

**NEW**

```md
### Story 1.7: Add Phase 1 Telemetry and Failure Classification

As a product owner or operator,
I want request and failure telemetry for the assistant,
So that I can observe production behavior and triage issues quickly.

**FRs implemented:** FR20, FR21, FR25
```

```md
### Story 1.8: Add Phase 1 Evaluation and Launch Guardrails

As a product owner or operator,
I want a repeatable evaluation suite for Phase 1,
So that launch readiness is judged against grounded-answer and permission-safety expectations.

**FRs implemented:** FR14, FR15, FR17
```

**Suggested acceptance criteria for Story 1.7**

```md
**Given** an assistant request is processed
**When** the request completes or fails
**Then** the system records a request ID, stage timings, mode, no-answer outcome, and failure classification
**And** retrieval, permission, and provider failures are distinguishable in telemetry.

**Given** entry indexing and retrieval activity occurs
**When** operational signals are recorded
**Then** the system captures freshness, request, and latency indicators needed for Phase 1 operations
**And** the signals are available to product and engineering stakeholders.
```

**Suggested acceptance criteria for Story 1.8**

```md
**Given** grounded answers are produced
**When** quality metrics are computed
**Then** citation coverage and latency metrics are recorded
**And** search and answer paths can be compared against their p95 targets.

**Given** the Phase 1 evaluation suite is run
**When** launch readiness is reviewed
**Then** the suite covers exact-match, semantic, no-answer, and ACL-sensitive entry scenarios
**And** results are available to product and engineering stakeholders.

**Given** unsupported narrative answers or blocked-source leakage are detected
**When** evaluation results are reviewed
**Then** the release is treated as not launch-ready
**And** remediation work is created before broader rollout.
```

**Rationale:** This split keeps each story closer to single-agent scope and separates instrumentation from launch-readiness judgment.

## 6. PRD MVP Impact and High-Level Action Plan

### MVP Impact

The MVP is **not** being reduced or redefined. Phase 1 remains the entry-backed assistant replacement already defined in the PRD and architecture.

### High-Level Action Plan

1. Update [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md) using the six proposed edits above.
2. Recheck FR coverage and within-epic sequencing after the edits land.
3. Rerun `bmad-check-implementation-readiness`.
4. If the readiness check passes, proceed to sprint planning.

### Dependency and Sequencing Notes

- Fix Story 3.3 before any sprint planning so the backlog no longer contains a known forward dependency.
- Apply the Story 1.7 split before estimation so Phase 1 sizing is based on the corrected story boundaries.
- Keep FR coverage map edits synchronized with story edits to avoid reintroducing traceability drift.

## 7. Implementation Handoff

### Scope Classification

**Moderate**

This is backlog reorganization and acceptance-criteria repair work. It does not require a new product strategy, but it should be owned deliberately rather than folded casually into development.

### Recommended Handoff

- **Product Owner / Scrum Master**
  Responsibility: apply the backlog structure changes in [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md), confirm numbering and sequencing, and ensure traceability remains consistent.
- **QA / Readiness Reviewer**
  Responsibility: rerun implementation-readiness validation after the artifact updates.
- **Development Team**
  Responsibility: wait for the corrected backlog before estimating or implementing the affected stories.

### Success Criteria

- No story references future-story capability as a condition of completion.
- Epic summaries and FR coverage map match story-level ownership.
- Approved UX requirements are represented in explicit, testable story acceptance criteria.
- Story 1.7 is split into independently estimable units.
- Readiness status improves from `NEEDS WORK` to a clean implementation-ready result.

## 8. Final Note

This proposal keeps the project on its current path while correcting the planning defects most likely to create execution churn. The key principle is simple: fix the backlog where the defects live, then revalidate before implementation starts.

## 9. Approval and Handoff

### Approval Status

Approved by Opsa on 2026-04-05.

### Handoff Route

Because this change is classified as **moderate** scope, the approved handoff is:

- **Primary owner:** Product Owner / Scrum Master workflow owner
- **Primary artifact to update:** [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md)
- **Follow-up validation:** rerun [implementation-readiness-report-2026-04-05.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/implementation-readiness-report-2026-04-05.md) workflow after edits

### Immediate Next Steps

1. Apply the approved backlog and acceptance-criteria edits in [epics.md](/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/epics.md).
2. Confirm FR coverage map and epic summaries remain synchronized after the edits.
3. Rerun implementation readiness before moving into sprint planning or development.
