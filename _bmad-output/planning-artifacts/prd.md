---
stepsCompleted:
  - "step-01-init"
  - "step-02-discovery"
  - "step-02b-vision"
  - "step-02c-executive-summary"
  - "step-03-success"
  - "step-04-journeys"
  - "step-05-domain"
  - "step-06-innovation"
  - "step-07-project-type"
  - "step-08-scoping"
  - "step-09-functional"
  - "step-10-nonfunctional"
  - "step-11-polish"
  - "step-12-complete"
inputDocuments:
  - "/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/research/technical-nerve-rag-assistant-research-2026-04-05.md"
  - "/home/opsa/Work/Nerve/_bmad-output/project-context.md"
  - "/home/opsa/Work/Nerve/docs/index.md"
  - "/home/opsa/Work/Nerve/docs/project-overview.md"
  - "/home/opsa/Work/Nerve/docs/architecture-api-server.md"
  - "/home/opsa/Work/Nerve/docs/component-inventory-web-client.md"
  - "/home/opsa/Work/Nerve/docs/data-models-api-server.md"
documentCounts:
  briefCount: 0
  researchCount: 1
  brainstormingCount: 0
  projectDocsCount: 5
  projectContextCount: 1
workflowType: "prd"
project_name: "Nerve"
user_name: "Opsa"
date: "2026-04-05"
classification:
  projectType: "web_app"
  domain: "edtech"
  complexity: "medium"
  projectContext: "brownfield"
---

# Product Requirements Document - Nerve

**Author:** Opsa
**Date:** 2026-04-05

## Executive Summary

Nerve is an existing role-based knowledge hub for Parul University teams, running today as a Vite/React single-page application backed by an Express API and PostgreSQL. The current AI experience in `src/pages/AIQuery.tsx` is not a production assistant; it is a disconnected local keyword fallback over bootstrap-loaded entry data, with no grounded retrieval, no citations, no permission-aware source handling, and no reliable abstention when evidence is weak. This PRD defines a brownfield feature that replaces that generic/local experience with a production-ready assistant inside the existing Nerve application.

The target product is a single assistant experience that combines grounded chat and natural-language search across Nerve knowledge sources. It must retrieve from existing plain-text entry content as well as uploaded files, PDFs, and images; return source-linked answers with citations; and enforce strict no-hallucination behavior by refusing to answer when the accessible evidence is insufficient. The assistant must honor Nerve's existing session auth, roles, teams, ownership rules, and access controls rather than introducing a parallel trust model. The brownfield requirement is explicit: the active runtime remains the current React SPA, Express API, and PostgreSQL stack, with retained Supabase AI artifacts treated as reference only, not as the deployment target.

This feature is intended to make organizational knowledge easier to find and safer to trust. Users should be able to ask one question, get either a grounded synthesis or a ranked search result set, inspect the supporting evidence, and open only the sources they are authorized to access. Retrieval quality must combine semantic similarity, exact-match behavior, and metadata-aware filtering so the assistant performs well for both exploratory questions and precise document-finding tasks. The product will be introduced in phases, starting with retrieval over existing `entries`, then expanding to private uploaded content and operational controls, so the team can improve trust, relevance, and coverage without destabilizing the current application.

The required model and platform direction for this PRD is fixed. Generation runs through Azure AI Foundry using `gpt-4.1-mini` as the primary answer model and `gpt-4.1-nano` as the lower-cost fallback for lightweight planner or fallback tasks. Embeddings use `text-embedding-3-small`. Document extraction uses `mistral-document-ai-2512` as the default extractor and `mistral-document-ai-2505` as the fallback extractor. These constraints are part of the product requirement because they shape expected assistant behavior, supported content types, rollout scope, and operating cost.

### What Makes This Special

This assistant is differentiated by trustworthiness inside an already permissioned product, not by generic chatbot behavior. It is designed to answer only from evidence Nerve can retrieve and the current user is allowed to access. That means citations are first-class, permission checks are first-class, and abstention is first-class. A response without evidence is a product failure, not an acceptable edge case.

The core insight is that Nerve already has the ingredients many RAG systems bolt on too late: authenticated users, role and team structure, ownership rules, PostgreSQL as the operational source of truth, and `pgvector` availability. The product opportunity is to turn those existing brownfield strengths into a reliable assistant that feels native to Nerve rather than layering a separate AI tool beside it. Users should experience one integrated workflow for asking, searching, verifying, and opening sources, with the system preferring "not enough evidence" over a fluent but ungrounded answer.

## Project Classification

- Project Type: `web_app`
- Domain: `edtech`
- Complexity: `medium`
- Project Context: `brownfield`

## Success Criteria

### User Success

Users can ask one natural-language question in the Nerve assistant and receive one of two trustworthy outcomes every time: a grounded answer with citations, or an explicit "not enough evidence" response when the accessible corpus is weak. The assistant must feel safer and more useful than the current local fallback page because it helps users search, verify, and open sources in one flow instead of forcing them to manually browse entries after a generic answer.

A successful user experience means:
- An authenticated user can find a relevant source for a known-item query, such as a document name, topic, department, or policy phrase, within 2 minutes without leaving the assistant workflow.
- A user can inspect at least one citation or evidence snippet for every substantive answer and open the underlying permitted source from that citation path.
- Users do not receive confident narrative answers without evidence. If support is weak, the assistant abstains or falls back to ranked source results.
- Users never see source titles, snippets, citations, or download/open actions for content they are not allowed to access.

### Business Success

This feature is successful for the product when it meaningfully replaces the current disconnected AI query experience and becomes a trusted internal retrieval surface for Nerve knowledge. Because Nerve is an internal role-based app, the primary business outcomes are adoption, trust, and reduced search friction rather than revenue.

Business success targets:
- Within 3 months of assistant launch, at least 50% of weekly active eligible users in Nerve use the assistant at least once per month.
- Within 3 months of assistant launch, at least 30% of weekly active eligible users use the assistant at least once per week.
- Within the first rollout phase, the existing `AIQuery` fallback experience is fully replaced for authenticated users by the new assistant experience.
- Within 1 quarter of rollout, the assistant becomes a standard retrieval path for content lookup, measured by meaningful source-open actions from assistant results and citations rather than only raw prompt count.
- Product stakeholders can review whether the assistant reduces manual browsing/search effort for common knowledge-finding tasks, using qualitative user feedback plus usage telemetry.

### Technical Success

Technical success means the assistant is grounded, permission-safe, observable, and operationally sustainable in the current React + Express + PostgreSQL runtime. It should improve the product without introducing a second source-of-truth for permissions or unstable AI behavior.

Technical success targets:
- 100% of non-abstaining narrative answers include at least one citation.
- Permission-leak rate is 0 in automated security tests and golden-query evaluation for blocked-source scenarios.
- Search-mode responses achieve p95 latency of 2.5 seconds or less for the initial brownfield corpus under normal load.
- Answer-mode responses achieve p95 latency of 8 seconds or less for grounded responses, excluding asynchronous ingestion time.
- Entry changes become searchable within 5 minutes of create or update in the initial rollout.
- Supported document ingestion succeeds for at least 95% of valid uploads within supported model limits, with failures surfaced clearly to operators and end users.
- The system exposes observability for retrieval latency, no-answer rate, citation coverage, ingestion failures, and model cost per request.

### Measurable Outcomes

The product should be evaluated with a seeded golden query set and live usage telemetry, not only anecdotal feedback.

Launch-quality measurable outcomes:
- At least 90% of curated known-answer search queries return a relevant source in the top 5 results.
- At least 85% of curated grounded-answer queries return an answer judged supported by the cited evidence.
- At least 90% of curated no-answer queries correctly abstain instead of producing a speculative answer.
- 100% of answer evaluations require citations for substantive claims.
- 0 blocked-source queries expose unauthorized filenames, snippets, or source links in evaluation runs.
- Source-open actions, citation clicks, and repeated assistant use show that users trust the assistant as a retrieval path rather than treating it as a novelty feature.

## Product Scope

### MVP - Minimum Viable Product

The MVP proves that Nerve can replace the current local fallback with a grounded assistant inside the existing application.

MVP scope:
- Replace `src/pages/AIQuery.tsx` with a production assistant page in the existing SPA.
- Support one assistant experience with `Auto`, `Search`, and `Ask` behaviors.
- Retrieve over existing Nerve plain-text entry content first.
- Use hybrid retrieval behavior that combines semantic, exact-match, and metadata-aware search.
- Return citations and source references for every substantive answer.
- Enforce strict no-answer behavior when evidence is weak.
- Enforce retrieval through existing authenticated session and permission context.
- Use Azure AI Foundry with `gpt-4.1-mini`, `gpt-4.1-nano`, and `text-embedding-3-small`.
- Keep the active runtime in Express + PostgreSQL + pgvector and do not depend on Supabase runtime paths.

### Growth Features (Post-MVP)

These features extend the assistant beyond entry-based retrieval into a broader governed knowledge workflow.

Growth scope:
- Add private upload and ingestion workflows for files, PDFs, and images.
- Extract text with `mistral-document-ai-2512` and fallback to `mistral-document-ai-2505`.
- Support citation locators for pages, snippets, and source actions across uploaded assets.
- Add ingestion job status, failure visibility, retry, and reindex controls.
- Add asset-level management and permission-aware source access for uploaded knowledge.
- Improve ranking quality, no-answer calibration, and corpus-specific relevance tuning.

### Vision (Future)

The future state makes the assistant a mature knowledge workflow layer for Nerve.

Vision scope:
- Persist assistant threads, messages, and citation history.
- Add analytics, evaluation dashboards, and operator tooling for answer quality and cost.
- Expand retrieval coverage to more Nerve-managed knowledge sources as the corpus grows.
- Add richer source filters, saved searches, and workflow-level follow-up interactions.
- Continue improving relevance and governance without changing the core brownfield architecture.

## User Journeys

### Journey 1: Priya, a content-team user, finds a trustworthy answer without leaving Nerve

**Opening Scene**  
Priya is a day-to-day Nerve user in the content team. She has a time-sensitive request from her department head: find the latest attendance guidance and related supporting material before a meeting. The current AI page is not reliable enough because it only returns local keyword matches from entries and gives her no evidence she can trust.

**Rising Action**  
Priya opens the new assistant from the same authenticated Nerve experience she already uses. She asks, "What files mention the 75% attendance requirement?" The assistant runs one permission-aware query across the content she is allowed to access: current `entries`, uploaded PDFs, and image-derived text where available. Instead of dumping raw matches, it chooses the right response shape for her question: a concise grounded answer plus a ranked source list. Each claim in the answer carries citations, and each source card shows a snippet, content-type label, and source action.

**Climax**  
Priya clicks a citation chip, opens the cited PDF page, and sees the supporting language directly. The value moment is not just that the assistant answered; it is that the assistant showed its work.

**Resolution**  
Priya leaves with a usable answer, a source she can share internally, and greater confidence in Nerve as a knowledge tool. The assistant saves time by compressing search, synthesis, and verification into one flow.

**Capabilities Revealed**
- Unified assistant experience for chat and natural-language search
- Retrieval across entries, files, PDFs, and image-extracted text
- Citation-first grounded answers
- Source actions for view/open/download where permitted
- Permission-aware retrieval so results reflect Priya's real access scope

### Journey 2: Arjun, an authenticated user, hits a weak-evidence case and the system refuses to guess

**Opening Scene**  
Arjun is trying to answer a question quickly before responding to a colleague: "What is the new admissions exception rule for late submissions?" He expects an answer, but the available corpus is incomplete, conflicting, or outside his access scope.

**Rising Action**  
Arjun asks the assistant in natural language. The assistant retrieves what it can access, but the evidence is sparse and low-confidence. Instead of producing a polished speculative answer, it explicitly says it cannot find enough evidence in the sources Arjun can access. It may still return a short ranked list of potentially relevant sources or suggest narrower follow-up phrasing.

**Climax**  
The critical product moment is that the assistant abstains. Arjun sees a clear no-answer state, not a misleading narrative, and can tell whether the issue is weak evidence, no matching documents, or lack of accessible sources.

**Resolution**  
Arjun does not leave with a fabricated answer he might repeat elsewhere. He either refines the search, opens a cited source that is available, or escalates to the correct owner knowing the system did not overstate certainty.

**Capabilities Revealed**
- Server-enforced no-answer behavior
- Clear weak-evidence and no-results states
- Search fallback when synthesis is unsafe
- Query refinement guidance
- Protection against citation, snippet, or filename leakage for inaccessible assets

### Journey 3: Meera, a team lead or admin, uploads new knowledge and makes it searchable

**Opening Scene**  
Meera is a content admin responsible for keeping Nerve useful for her team. She receives a new PDF policy document and a poster image that should be discoverable by others, but only within the right permission boundaries. In the current product, there is no production ingestion path for that material.

**Rising Action**  
Meera uploads the file through Nerve, assigns the appropriate ownership or team visibility, and submits it for processing. The system stores the file privately, extracts the text, indexes the result, and shows status as `processing`, `ready`, or `failed`. Meera can later verify that the document appears in assistant results with proper citations and that only authorized users can open it.

**Climax**  
The moment of success is when Meera can ask the assistant a natural-language question about the newly uploaded document and see it come back as a cited, permission-safe source. She knows the ingestion path is turning files into governed knowledge, not just storing them.

**Resolution**  
Meera gains confidence that Nerve can support real operational knowledge, not only manually entered text rows. The assistant becomes more valuable over time because admins can expand the searchable corpus without breaking trust or access boundaries.

**Capabilities Revealed**
- Authenticated file upload for PDFs, documents, and images
- Private storage and permission-aware source access
- Ingestion lifecycle visibility and retryable failures
- OCR/extraction-backed indexing for non-text assets
- Verification that newly indexed sources appear correctly in assistant results

### Journey 4: Kavya, a super admin or operator, investigates a trust or retrieval problem

**Opening Scene**  
Kavya is responsible for system-level confidence in Nerve. A user reports either "I can't find a document I should be able to access" or "I think the assistant answered from the wrong source." In the current state, there is no operational layer for assistant-specific investigation.

**Rising Action**  
Kavya checks the affected asset or query path in the assistant operations surface. She reviews whether the source was indexed, whether extraction failed, whether permissions were applied correctly, and whether the returned citation mapped to the expected asset version. If needed, she retries ingestion, reindexes the asset, or corrects an ownership or ACL issue.

**Climax**  
The key value moment is that Kavya can explain what happened from evidence, not guesswork. She can see whether the issue was missing content, failed processing, stale indexing, or a legitimate permission boundary.

**Resolution**  
Kavya restores confidence for both the reporting user and the wider organization. The assistant is not just usable; it is supportable.

**Capabilities Revealed**
- Admin visibility into ingestion/job status
- Reindex and retry workflows
- Citation-to-source traceability
- Permission and ownership diagnostics
- Operational monitoring for quality, failures, and trust issues

### Journey Requirements Summary

These journeys reveal that the assistant must support four capability layers, not only a chat box:
- Retrieval and answer experience for authenticated end users, with grounded answers, search results, citations, and source-open flows
- Explicit abstention behavior for weak-evidence and inaccessible-content scenarios
- Knowledge ingestion and governance workflows for admins managing PDFs, files, images, and permissions
- Operational support and audit workflows for super admins or operators investigating failures, relevance issues, and access problems

They also clarify one important scope boundary:
- A standalone external API-consumer journey is not required for MVP. The first product version is an in-app assistant for existing Nerve users, even if internal endpoints will exist behind the UI.

## Domain-Specific Requirements

### Compliance & Regulatory

- The assistant must preserve institution-level privacy boundaries for education-related content. If the indexed corpus includes student-identifiable materials such as attendance guidance tied to students, academic standing records, or other protected educational records, retrieval and source access must support FERPA-aligned access restriction and auditing expectations.
- The product must not assume that all university knowledge is globally visible to all authenticated users. Departmental, team, and owner-based restrictions are part of the domain requirement, not just a technical preference.
- Accessibility is a domain requirement for the assistant experience and citation flows. Users must be able to operate the assistant, inspect evidence, and open cited sources with keyboard support, readable structure, and accessible labeling consistent with the rest of the web application.
- Time-bounded institutional guidance matters in education settings. Where source metadata exists, the assistant should preserve or display signals such as academic year, source date, and current version so users can distinguish current guidance from outdated material.
- COPPA-specific child privacy requirements are not a primary launch driver for the current university-focused Nerve scope, but the product should not assume those rules are irrelevant if future use expands into under-18 or K-12-adjacent contexts.

### Technical Constraints

- Permission-aware retrieval is mandatory because university knowledge is not uniformly public inside the institution. The assistant must enforce access using the existing Nerve session, role, team, ownership, and access-control model.
- The assistant must treat uploaded institutional documents as private by default unless product policy explicitly says otherwise. Public static file access is incompatible with the trust model required for educational and administrative content.
- The system must handle mixed-quality source material common in educational operations, including scanned PDFs, circulars, notices, posters, and image-based documents. When extraction quality is weak, the assistant must degrade safely by abstaining or returning source search results instead of overstating certainty.
- Metadata such as department, content type, academic year, owner, and team visibility is domain-relevant retrieval context and must influence ranking and filtering behavior.
- The assistant must preserve trust when policies evolve over time. If multiple versions of institutional guidance exist, the product should avoid presenting stale or superseded content as if it were the current answer.

### Integration Requirements

- The assistant must integrate with the existing Nerve authentication and authorization model rather than introducing a separate educational identity or policy model.
- The assistant must work across the knowledge already present in Nerve today, especially `entries`, and then extend to uploaded documents, PDFs, and images without requiring a parallel product workflow.
- Source-open flows must remain inside authenticated Nerve behavior so users move from answer to evidence without losing access enforcement.
- No external LMS, SIS, or student-record-system integration is required for MVP, but future integrations must preserve the same permission-aware retrieval and citation standards defined here.

### Risk Mitigations

- Risk: Users receive outdated policy guidance.
  Mitigation: Preserve source metadata, prefer current accessible versions where possible, and always expose citations so users can inspect the underlying source.
- Risk: Users see restricted academic or departmental content.
  Mitigation: Enforce retrieval-time authorization, block unauthorized citation/snippet leakage, and require the same checks for source open/download actions.
- Risk: Users trust fluent answers that are not actually supported.
  Mitigation: Require evidence-backed answers, enforce no-answer behavior when support is weak, and present ranked sources instead of speculative synthesis.
- Risk: OCR or extraction quality is poor for posters, scans, or complex PDFs.
  Mitigation: Show ingestion status, support retry/fallback extraction, and avoid fabricating meaning from weak extraction output.
- Risk: The assistant becomes hard to use for staff relying on assistive technology or keyboard navigation.
  Mitigation: Treat accessibility as part of launch quality for the assistant UI, citations, and evidence panel, not as post-launch polish.

## Web App Specific Requirements

### Project-Type Overview

Nerve's assistant is an authenticated `web_app` feature inside the existing React SPA, not a separate product surface, public website, or MPA flow. The assistant must live within the current routed application shell, inherit the existing session-authenticated experience, and feel like a native extension of Nerve rather than an external AI tool.

### Technical Architecture Considerations

The assistant must operate as a first-class route in the current SPA and use the existing application boundary to the Express API. The product does not require a public-facing search surface, static SEO landing pages, or a second client runtime. It must support authenticated navigation, route protection, and source-access actions within the same browser session and app shell already used by Nerve users.

The web experience must prioritize:
- A single in-app assistant surface for `Auto`, `Search`, and `Ask` modes
- Authenticated route access consistent with current `RoleGuard` behavior
- Seamless movement between answer, citation, and source-open flows
- Progressive disclosure of evidence, filters, and ingestion status without forcing users into separate tools

### Browser Matrix

Launch support should target modern evergreen browsers used by internal staff and admins:
- Current mainstream desktop Chrome and Edge
- Current mainstream desktop Safari and Firefox
- Modern mobile Safari and Chrome on supported phones/tablets
- No Internet Explorer or legacy-browser support requirement

### Responsive Design

The assistant must work across desktop and mobile form factors, with desktop as the primary productivity surface and mobile/tablet usability treated as a launch requirement rather than a post-launch enhancement. Core tasks such as asking a question, reviewing citations, opening filters, and inspecting source evidence must remain usable on smaller screens without breaking navigation or hiding critical trust signals.

### Performance Targets

Because this is a browser-based assistant inside an existing productivity workflow, the UI must preserve perceived responsiveness and clear state transitions. The route must provide visible loading, processing, failure, and no-answer states so users understand whether the system is retrieving, abstaining, or still processing new content. The assistant must avoid feeling like a blocking full-page workflow.

### SEO Strategy

SEO is not a product requirement for this feature. The assistant is an authenticated internal application route, so discovery through search engines is irrelevant to MVP and should not drive product decisions, routing, or content structure.

### Accessibility Level

Core assistant flows should meet WCAG 2.1 AA expectations for keyboard access, focus order, readable semantics, labeling, and citation/source interactions. Accessibility coverage must include the query composer, mode controls, filters, response content, citation chips, evidence panels, and source-open actions.

### Implementation Considerations

For this project type, the brownfield product requirements imply:
- Reuse the existing authenticated SPA shell instead of introducing a second web client
- Preserve current route and role patterns for assistant access
- Favor in-app state transitions over page reloads or public document URLs
- Treat real-time streaming or live collaboration as optional enhancements, not MVP requirements
- Keep the assistant experience compatible with the current API-backed runtime and existing UI primitive library

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP focused on replacing the current fake/local AI page with a trustworthy assistant that users can actually rely on for retrieval and evidence-backed answers inside the existing Nerve app.

**Resource Requirements:** 2 full-stack/backend-leaning engineers, part-time frontend/design support for the assistant UX, and part-time QA/product support for evaluation, security checks, and rollout validation.
**Resource Requirements:** 2 backend-leaning full-stack engineers, part-time frontend/design support for the assistant UX, and part-time QA/product support for evaluation, security checks, and rollout validation.

The MVP should optimize for validated trust and usefulness, not feature breadth. The minimum bar is that an authenticated Nerve user can query existing knowledge, receive either a grounded answer with citations or a clear no-answer response, and open only sources they are allowed to access.

### MVP Feature Set (Phase 1)

The functional requirement inventory in this document describes the full planned assistant capability set across phases. Implementation readiness for Phase 1 is judged against this MVP feature set and its explicit deferrals; later-phase requirements such as mixed-media ingestion, saved history, and advanced quality-review tooling are not Phase 1 blockers.

**Core User Journeys Supported:**
- Priya's trusted retrieval journey over existing accessible knowledge
- Arjun's weak-evidence journey where the system abstains instead of guessing
- Basic operator validation that indexed entry content is retrievable and citations map to real sources

**Must-Have Capabilities:**
- Replace the current `AIQuery` route with a real assistant page in the existing SPA
- Support one assistant experience with `Auto`, `Search`, and `Ask` behaviors
- Retrieve from existing Nerve plain-text `entries` and their metadata
- Use permission-aware retrieval based on current authenticated session context
- Return citations and evidence snippets for every substantive answer
- Enforce no-answer behavior when evidence is weak or inaccessible
- Support source-open flows for permitted Nerve sources
- Provide clear loading, no-results, no-answer, and error states
- Instrument the feature for usage, latency, citation coverage, and permission-safety validation

**Explicitly Deferred From MVP:**
- General private file upload workflows for end users
- PDF/image extraction and OCR-backed retrieval
- Asset-management consoles and detailed reindex tooling
- Saved threads, message history, and citation history persistence
- Advanced analytics dashboards beyond launch telemetry
- Broader cross-system integrations outside current Nerve content sources

### Post-MVP Features

**Phase 2 (Post-MVP):**
- Private uploads for files, PDFs, and images
- Extraction via `mistral-document-ai-2512` with fallback to `mistral-document-ai-2505`
- Ingestion status, retry, and failure visibility
- Citation locators for uploaded documents and page-level evidence
- Admin-facing asset management and permission-aware source controls
- Retrieval tuning for mixed corpus quality and broader metadata filters

**Phase 3 (Expansion):**
- Saved assistant threads and message-level citation history
- Evaluation dashboards, cost analytics, and operator insights
- Expanded coverage to additional Nerve-managed knowledge sources
- Richer follow-up workflows, filters, and knowledge operations tooling
- More mature governance around versioning, freshness, and lifecycle controls

### Risk Mitigation Strategy

**Technical Risks:**  
The biggest technical risk is trying to deliver entry-based RAG, private uploads, OCR extraction, ACL-safe source access, and operational tooling all at once. Mitigation: keep phase 1 limited to existing `entries`, existing auth/session context, and evidence-backed answers; treat file ingestion as a separate next phase.

**Market Risks:**  
The biggest product risk is that users may see the assistant as just another AI layer rather than a trustworthy retrieval tool. Mitigation: optimize phase 1 around citation-backed usefulness, abstention quality, and real source-open behavior instead of broad generative capability.

**Resource Risks:**  
The biggest resource risk is underestimating evaluation and permission-safety work. Mitigation: define a lean MVP, use the existing React/Express/PostgreSQL runtime, defer non-essential admin surfaces, and require a golden-query evaluation set before broader rollout.

## Functional Requirements

### Assistant Experience

- FR1: Authenticated users can open a single assistant workspace inside Nerve for both natural-language search and grounded question answering.
- FR2: Authenticated users can submit natural-language queries in `Auto`, `Search`, or `Ask` mode.
- FR3: Authenticated users can refine, rephrase, or continue a prior query within the same assistant session.
- FR4: Authenticated users can apply source and metadata filters to narrow assistant results.
- FR5: Authenticated users can see clear loading, processing, empty, error, and no-answer states during assistant use.
- FR6: Authenticated users can receive either an answer-focused response or a results-focused response from the same assistant experience, depending on query intent.

### Content Discovery

- FR7: Authenticated users can search across existing Nerve entries and indexed knowledge assets from one query surface.
- FR8: Authenticated users can discover content through semantic topic matching.
- FR9: Authenticated users can discover content through exact keyword and phrase matching.
- FR10: Authenticated users can discover content using metadata such as department, content type, academic year, source kind, owner, or visibility context.
- FR11: Authenticated users can receive assistant results spanning plain-text content, uploaded files, PDFs, and image-derived text.
- FR12: Authenticated users can view source descriptors, snippets, and content-type indicators for returned results.
- FR13: Authenticated users can open an authorized source directly from a result card or source list.

### Grounded Answers & Citations

- FR14: Authenticated users can receive answers grounded only in retrievable source evidence.
- FR15: Authenticated users can see citations for every substantive assistant answer.
- FR16: Authenticated users can inspect the supporting evidence behind each citation, including relevant snippets or source locators.
- FR17: Authenticated users can receive an explicit insufficient-evidence response when the assistant cannot support a reliable answer.
- FR18: Authenticated users can receive ranked source results instead of narrative synthesis when the query is better served as search.
- FR19: Authorized operators can inspect which sources supported a stored or reviewed assistant answer.

### Access Control & Source Governance

- FR20: The system can limit assistant retrieval to sources the current user is authorized to access.
- FR21: The system can enforce the same authorization rules for results, snippets, citations, previews, and source-open actions.
- FR22: Authorized admins can define whether indexed content is visible to all authenticated users, a team, an owner, or an explicit allowed audience.
- FR23: Authorized admins can update ownership, team visibility, or source access rules for indexed content.
- FR24: The system can reflect changed permissions in assistant behavior without exposing previously accessible but now-restricted content.

### Knowledge Ingestion & Source Lifecycle

- FR25: The system can index existing Nerve entries as assistant knowledge sources.
- FR26: Authorized users can submit new files to the assistant knowledge corpus.
- FR27: Authorized users can submit PDFs for searchable and citable retrieval.
- FR28: Authorized users can submit images for text-grounded retrieval.
- FR29: The system can represent plain text, files, PDFs, and image-derived content within one searchable knowledge corpus.
- FR30: The system can refresh or replace indexed knowledge when a source changes.
- FR31: Authenticated users and admins can see whether a newly submitted source is processing, ready, failed, or otherwise unavailable.

### Operations & Quality Management

- FR32: Authorized admins can view indexed asset status and retrieval readiness.
- FR33: Authorized admins can retry failed processing or reindex a source.
- FR34: Authorized operators can investigate retrieval failures, citation mismatches, and permission-related assistant issues.
- FR35: Authorized product or operations users can review assistant usage, source-open activity, citation coverage, no-answer behavior, and ingestion failure signals.

### Conversation Continuity

- FR36: Authenticated users can view saved assistant threads.
- FR37: Authenticated users can reopen a prior thread and continue the conversation with preserved context.
- FR38: The system can persist citations alongside saved assistant answers for later review.

## Non-Functional Requirements

### Performance

- Search-mode responses must achieve p95 latency of 2.5 seconds or less for the initial brownfield corpus under normal expected load.
- Answer-mode responses must achieve p95 latency of 8 seconds or less for grounded responses, excluding asynchronous ingestion time.
- Core assistant interactions must expose immediate visible state changes for loading, processing, failure, and no-answer outcomes so users are never left without system feedback.
- Entry-based knowledge updates must become searchable within 5 minutes of create or update during phase 1.
- Source-open actions for authorized content must complete without forcing users through a separate unauthenticated workflow.

### Security & Privacy

- All assistant queries, results, citations, previews, and source-open actions must require an authenticated Nerve session.
- The assistant must enforce authorization consistently across retrieval, answer generation, snippets, citations, and source access.
- The system must produce zero unauthorized filename, snippet, citation, or source-link leakage in blocked-source security tests.
- Uploaded assistant content and stored assistant data must be protected in transit and at rest according to production security standards used for the rest of the Nerve application.
- Privileged assistant operations such as source upload, reindex, retry, permission changes, and source-access decisions must be auditable by authorized operators.

### Reliability & Recoverability

- The assistant must fail safely: when evidence is weak, source access is denied, or a model dependency is unavailable, the system must return a no-answer or search-style response rather than an unsupported narrative answer.
- Ingestion failures must be surfaced with explicit status so users and operators can distinguish processing failure from missing content.
- Failed ingestion or indexing work must be retryable without requiring the source to be recreated from scratch.
- Retrieval and citation behavior must remain consistent enough that operators can trace an answer back to the supporting source set during investigation.
- The assistant must degrade gracefully when downstream AI services are unavailable, instead of presenting misleading success states.

### Groundedness & Answer Quality

- 100% of non-abstaining substantive answers must include at least one citation.
- The assistant must abstain when available evidence does not meet the minimum support threshold defined for grounded answering.
- At least 85% of curated grounded-answer evaluation queries must be judged supported by their cited evidence.
- At least 90% of curated no-answer evaluation queries must correctly abstain instead of producing speculative answers.
- Search quality must return a relevant source in the top 5 results for at least 90% of curated known-answer search queries in the launch evaluation set.

### Accessibility

- Core assistant flows must meet WCAG 2.1 AA expectations for keyboard operation, focus management, semantics, labeling, and readable content structure.
- Accessibility coverage must include the query composer, mode controls, filters, result cards, citation chips, evidence views, and source-open actions.
- No trust-critical information may be conveyed by color alone.
- Assistant responses, citations, and evidence panels must remain usable with screen readers and keyboard-only navigation.

### Observability & Operations

- The product must track assistant request latency, retrieval latency, ingestion success/failure, no-answer rate, citation coverage, and blocked-source security test results.
- The product must track model usage and per-request cost signals for generation, embedding, and extraction workloads.
- Operators must be able to distinguish retrieval failures, permission failures, ingestion failures, and model/provider failures in operational telemetry.
- Launch readiness must include a golden-query evaluation set covering exact-match queries, semantic queries, no-answer scenarios, and ACL-sensitive scenarios.
