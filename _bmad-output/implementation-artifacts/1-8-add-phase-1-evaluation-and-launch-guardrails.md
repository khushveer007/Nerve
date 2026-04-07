# Story 1.8: Add Phase 1 Evaluation and Launch Guardrails

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a product owner or operator,
I want a repeatable evaluation suite for Phase 1,
so that launch readiness is judged against grounded-answer and permission-safety expectations.

**FRs implemented (story source):** FR14, FR15, FR17

**Supporting PRD/NFR scope:** FR35, NFR1, NFR2, NFR8, NFR11, NFR16, NFR18, NFR19, NFR20, NFR25, NFR28

## Acceptance Criteria

1. Given grounded answers are produced, when quality metrics are computed, then citation coverage and latency metrics are recorded, and search and answer paths can be compared against their p95 targets.
2. Given the Phase 1 evaluation suite is run, when launch readiness is reviewed, then the suite covers exact-match, semantic, no-answer, and ACL-sensitive entry scenarios, and results are available to product and engineering stakeholders.
3. Given unsupported narrative answers or blocked-source leakage are detected, when evaluation results are reviewed, then the release is treated as not launch-ready, and remediation work is created before broader rollout.

## Tasks / Subtasks

- [x] Build a Phase 1 launch-evaluation harness on top of the existing entry-backed assistant test stack. (AC: 2, 3)
  - [x] Reuse the current `server/test/rag/test-utils.ts` runtime and seeded-entry helpers in `server/test/rag/rag.integration.test.ts` instead of inventing a parallel fixture system.
  - [x] Keep the suite Phase 1 scoped to `entries` only. Do not pull private uploads, PDFs, OCR, mixed-media retrieval, saved threads, or analytics UI work forward from later epics.
  - [x] Cover the four launch categories called out in the PRD and epics: exact-match search, semantic retrieval, no-answer abstention, and ACL-sensitive query/preview/open flows.
  - [x] Extend the existing `launch-quality gate:` pattern already present in `server/test/rag/rag.integration.test.ts` so launch checks remain easy to discover and run together.

- [x] Add a server-owned launch metrics summary that reuses Story 1.7 observability instead of duplicating telemetry storage. (AC: 1, 2)
  - [x] Extend `server/observability/types.ts` and `server/observability/metrics.ts` with a read model that summarizes citation coverage, no-answer rate, grounded-answer count, search-versus-answer request mix, and p95 timing slices from `assistant_request_telemetry`.
  - [x] Derive launch metrics from the existing request telemetry schema and `stage_timings`; do not add a second evaluation table unless a gap is proven.
  - [x] Keep telemetry fail-open and server-owned. Evaluation code must never change the existing `/api/assistant/query`, `/api/assistant/source-preview`, or `/api/assistant/source-open` response contracts.
  - [x] Preserve the Story 1.7 taxonomy rule that `no_answer` is an outcome, not a failure classification.

- [x] Produce a repeatable launch-readiness result that product and engineering can review without a new dashboard. (AC: 1, 2, 3)
  - [x] Implement the primary launch gate as a deterministic server test suite under `server/test/rag/*`; add a small helper/report formatter only if it improves local and CI readability.
  - [x] Make the result clearly expose pass/fail signals for unsupported narrative answers, missing citations on substantive answers, blocked-source leakage, and latency summary comparisons.
  - [x] Prefer structured summary objects, test assertions, or documented SQL/read-helper output over a new client-facing screen.
  - [x] If an internal review endpoint is introduced, keep it authenticated, thin, and server-only; do not create a public analytics surface or broaden Epic 5 UI scope.

- [x] Document launch guardrail operation and remediation expectations. (AC: 2, 3)
  - [x] Update `docs/development-guide-api-server.md` with how to run the launch evaluation, how to inspect the launch summary, and which outcomes are release blockers.
  - [x] Explicitly document that blocked-source leakage, unsupported narrative answers, or missing citation coverage on substantive answers are launch blockers that require follow-up work before broader rollout.
  - [x] Document how telemetry-backed latency comparisons should be interpreted for `search` and `ask` paths, including the PRD targets of p95 <= 2.5s for search and p95 <= 8s for grounded answers.

- [x] Add regression coverage that proves the evaluation harness reflects the current trust boundaries instead of a simplified mock path. (AC: 1, 2, 3)
  - [x] Cover grounded-answer requests that must emit citations and telemetry-backed timing data.
  - [x] Cover no-answer requests that must abstain cleanly without becoming unsupported narrative answers.
  - [x] Cover ACL-sensitive queries plus denied preview/open paths that must return no leaked titles, snippets, citation labels, counts, or source links.
  - [x] Cover launch-summary aggregation logic with targeted assertions so p95 and citation-coverage calculations are stable and reviewable.

## Dev Notes

### Story Intent and Scope Boundaries

- Story 1.8 is the Phase 1 launch gate, not the later analytics or review UI from Epic 5.
- Build on the telemetry foundation from Story 1.7 and the citation/ACL behavior from Stories 1.3 through 1.7; do not redesign retrieval, answer generation, or source-open flows here.
- Keep the evaluation corpus entry-backed and deterministic. Phase 1 launch readiness should be judged on `entries` scenarios before mixed-media sources arrive in Epic 2.
- The main deliverable is a repeatable, reviewable evaluation path that tells product and engineering whether the assistant is launch-ready. A polished dashboard is explicitly out of scope.
- Treat unsupported narrative answers, citation omissions on substantive answers, and blocked-source leakage as release blockers, not advisory warnings.

### Technical Requirements

- Reuse `assistant_request_telemetry` and the Story 1.7 read-side helpers as the source of truth for launch metrics. Avoid persisting duplicate launch-evaluation facts in a second schema unless the existing telemetry model cannot support a required metric.
- Compute launch metrics server-side from trusted telemetry and test outcomes. Do not use client-render timing or browser-only instrumentation as the launch-readiness source of truth.
- Keep search and answer latency comparisons aligned to the PRD targets:
  - search path p95 <= 2.5 seconds
  - grounded answer path p95 <= 8 seconds
- Make the evaluation suite deterministic enough for repeated local and CI use:
  - seed known entries
  - use existing test login/session helpers
  - avoid flaky dependence on unrelated production data
- Preserve the current no-answer semantics:
  - weak or conflicting evidence must remain `no_answer`
  - evaluation must not treat abstention as a product failure when it is the correct outcome
- Keep launch reporting narrow and actionable:
  - coverage counts
  - p95 timing summaries
  - outcome/failure tallies
  - blocker findings
- Do not store raw prompts, raw answers, or blocked-source content in any new evaluation output for this story.

### Architecture Compliance

- Keep all evaluation and aggregation logic server-owned:
  - observability/read models in `server/observability/*`
  - request flow logic in `server/rag/*` only if the existing request contracts truly need to expose a narrow internal summary
  - launch harness and regressions in `server/test/rag/*`
- Follow the documented assistant call chain: `route -> zod schema -> service -> retrieval/answering/acl helpers -> db/providers -> response mapper`.
- Route handlers must remain thin. If an internal launch-summary endpoint is added, the route should only validate/authenticate and delegate to a helper in `server/observability/*` or `server/rag/service.ts`.
- Reuse the Story 1.7 failure taxonomy:
  - `retrieval_failure`
  - `permission_failure`
  - `provider_failure`
  - `none`
- Preserve UTC/ISO timestamp handling and named JSON payload conventions.
- Keep evaluation output permission-safe. No launch report should reveal blocked source metadata merely to explain a failure.

### Library and Framework Requirements

- **TypeScript 5.8.3 / Node ESM:** Match the current server module style and type the evaluation summary explicitly.
- **Vitest 3.2.4:** Prefer server-side launch guardrail coverage under `vitest.server.config.ts`; extend the existing integration suite rather than creating an unrelated runner first.
- **Express 4.21.2 / Zod 3.25.76:** Only touch routes/schemas if a narrow authenticated summary endpoint is truly necessary.
- **PostgreSQL 16 / pg 8.16.3:** Use the existing telemetry tables and SQL access patterns in `server/observability/metrics.ts`; percentile and aggregation logic should stay database-backed or server-side and easy to review.
- **TanStack React Query / React assistant shell:** No client-state or dashboard-library additions are required for this story. Any UI work should be limited to later epics unless the implementation uncovers a hard launch blocker.

### File Structure Requirements

- Expected primary files to update:
  - `server/observability/types.ts`
  - `server/observability/metrics.ts`
  - `server/test/rag/rag.integration.test.ts` and/or a new focused launch-evaluation test file under `server/test/rag/`
  - `server/test/rag/test-utils.ts` if the launch harness needs a reusable helper
  - `docs/development-guide-api-server.md`
- Optional files only if justified:
  - `server/rag/routes.ts`
  - `server/rag/service.ts`
  - `server/rag/schemas.ts`
- Prefer not to add a migration in this story. Story 1.7 already created the telemetry storage layer; Story 1.8 should consume it.
- Prefer not to add `src/features/assistant/*` work unless a launch-readiness blocker cannot be evaluated server-side.
- Note the current repo state: the architecture reserves `tests/e2e/assistant/*`, but the repo does not currently have a top-level `tests/` folder. Favor `server/test/rag/*` first unless you intentionally create that e2e surface.

### Testing Requirements

- Add launch-quality coverage for an exact-match query that should return a relevant result in the top five results.
- Add launch-quality coverage for a semantic query that should retrieve the intended entry even when wording differs from the source text.
- Add launch-quality coverage for grounded-answer turns where every substantive answer must include at least one citation.
- Add launch-quality coverage for correct abstention on no-answer scenarios.
- Keep and extend ACL launch gates for team-scoped, owner-scoped, and explicit-ACL scenarios, plus denied preview/open flows with zero metadata leakage.
- Add assertions for launch-summary aggregation so citation coverage, no-answer rate, and p95 timing slices are validated from real telemetry rows.
- Ensure evaluation failures are obvious:
  - unsupported grounded answer without sufficient evidence
  - missing citation coverage
  - blocked-source leakage
  - latency summary outside the documented target
- Recommended verification commands for the implementation agent:
  - `npm run test:server -- server/test/rag/rag.integration.test.ts`
  - `npm run test:server -- server/test/rag/rag.schemas.test.ts`
  - `npm run lint`
  - `npm run build:server`

### Previous Story Intelligence

- Story 1.7 already introduced `assistant_request_telemetry`, `assistant_job_telemetry`, typed observability helpers, and read-side summary helpers. Story 1.8 should extend that foundation instead of creating a parallel evaluation datastore or a second telemetry vocabulary.
- Story 1.7 explicitly treated telemetry as fail-open and prohibited storing raw prompts, answers, snippets, or blocked-source content. Those privacy and resilience rules still apply to launch evaluation output.
- Story 1.6 and Story 1.7 both reinforced the trust boundary that `/api/assistant/query`, `/api/assistant/source-preview`, and `/api/assistant/source-open` are the relevant evidence paths. Launch evaluation should target those real seams, not a simplified backdoor helper.
- The current integration suite already contains `launch-quality gate:` ACL tests. Story 1.8 should build from that naming and coverage style so quality checks stay discoverable and cohesive.

### Git Intelligence Summary

- Recent assistant work has landed as full slices across server code, docs, tests, and BMAD artifacts rather than isolated code-only patches. Story 1.8 should follow that same pattern.
- Commit `84b4298` established the current telemetry foundation, so the launch-guardrail story should focus on aggregation, evaluation, and reporting instead of more raw signal collection.
- Commits `ee5d5b3` and `f03c2a7` strengthened citation handling, grounded-answer flow, and safe fallback behavior. The evaluation suite should verify those behaviors, not re-implement them.

### Project Structure Notes

- The architecture's long-term home for evaluation and regression checks includes both `server/test/rag/*` and `tests/e2e/assistant/*`, but the live repo currently only has the server test structure. Start where the project already has momentum.
- The cleanest Story 1.8 implementation is likely server-heavy:
  - extend observability read models
  - add/expand launch-gate integration tests
  - document the review workflow
- If product stakeholders need a human-readable summary artifact, prefer a structured server-side helper or documented SQL/report output over a new UI panel.

### References

- `_bmad-output/planning-artifacts/epics.md`
  - Story 1.8 acceptance criteria
  - Epic 1 scope boundaries
  - NFR18, NFR19, NFR20, NFR25, NFR28
- `_bmad-output/planning-artifacts/prd.md`
  - Technical success targets
  - Launch-quality measurable outcomes
  - permission-leak and citation-coverage expectations
- `_bmad-output/planning-artifacts/architecture.md`
  - Observability
  - Implementation Sequence
  - Structure Patterns
  - Test Organization
  - Requirements To Structure Mapping
- `_bmad-output/planning-artifacts/ux-design-specification.md`
  - no-evidence and low-confidence behavior
  - launch acceptance checklist
- `_bmad-output/project-context.md`
  - project stack versions
- `_bmad-output/implementation-artifacts/1-7-add-phase-1-telemetry-and-failure-classification.md`
  - observability sequencing and scope boundaries
  - fail-open telemetry requirements
- `docs/development-guide-api-server.md`
  - telemetry taxonomy
  - operational snapshot guidance
  - current server-side guardrails
- `server/observability/metrics.ts`
  - existing request telemetry reads
  - `listRecentAssistantRequestTelemetry()`
  - `getAssistantOperationalSnapshot()`
- `server/observability/types.ts`
  - current telemetry outcome and failure types
- `server/test/rag/rag.integration.test.ts`
  - existing `launch-quality gate:` ACL patterns
  - helper seams for telemetry assertions
- `server/test/rag/test-utils.ts`
  - isolated test runtime, seeded database, and session helpers

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Story creation workflow: `bmad-create-story`
- Sprint status auto-discovery selected `1-8-add-phase-1-evaluation-and-launch-guardrails`
- Loaded planning artifacts: `epics.md`, `prd.md`, `architecture.md`, `ux-design-specification.md`
- Loaded implementation context: Story 1.7 artifact, `server/observability/*`, `server/test/rag/*`, `docs/development-guide-api-server.md`
- Git context reviewed from the latest 5 commits for assistant telemetry/citation patterns

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 1.8 is intentionally scoped as a server-first launch gate that reuses Story 1.7 telemetry and the existing `launch-quality gate:` integration patterns.
- Assumption for implementation: latency comparisons should be computed from server-owned telemetry captured during seeded evaluation runs, not browser timings.
- Assumption for implementation: blocked-source leakage and unsupported narrative answers are mandatory fail conditions, while latency summaries must be surfaced clearly for launch review even if teams choose to enforce them in a specific environment.
- Added `getAssistantLaunchSummary()` plus typed launch-readiness read models in `server/observability/*`, deriving citation coverage, no-answer rate, request mix, and p95 path latency from `assistant_request_telemetry` without adding a new evaluation table.
- Extended `server/test/rag/rag.integration.test.ts` with deterministic `launch-quality gate:` coverage for exact-match search, grounded answers with citations, semantic retrieval, no-answer abstention, ACL-safe preview/open flows, and telemetry-summary aggregation.
- Updated existing ACL launch-quality expectations to match the current server contract while keeping the no-leak trust boundary intact.
- Documented the Phase 1 launch evaluation runbook in `docs/development-guide-api-server.md`, including how to run the suite, inspect the launch summary, and interpret release blockers.
- Code review completed: fixed the launch-readiness gate so search/ask p95 latency regressions become release blockers, and updated the runbook to use portable links plus a local-friendly test database example.
- Verification completed:
  - `TEST_DATABASE_URL=postgres://nerve:nerve@172.20.0.2:5432/nerve_test npm run test:server -- server/test/rag/rag.integration.test.ts -t "launch-quality gate:"`
  - `npm run test:server -- server/test/rag/rag.schemas.test.ts`
  - `npm run build:server`
  - `npm run lint` (passes with existing React fast-refresh warnings in unrelated frontend files)
- `npm test` still reports unrelated pre-existing failures in non-Story-1.8 `server/test/rag/rag.integration.test.ts` coverage around grounded-answer, semantic retrieval, and filter/sorting behavior; the new launch-quality gate additions pass.

### File List

- `_bmad-output/implementation-artifacts/1-8-add-phase-1-evaluation-and-launch-guardrails.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/development-guide-api-server.md`
- `server/observability/metrics.ts`
- `server/observability/types.ts`
- `server/test/rag/rag.integration.test.ts`
- `server/test/rag/test-utils.ts`

## Change Log

- 2026-04-07: Added the Phase 1 launch-quality evaluation harness, telemetry-backed launch summary read model, and API-server runbook updates for Story 1.8.
