---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
  - 6
  - 7
  - 8
  - 9
  - 10
  - 11
  - 12
  - 13
  - 14
lastStep: 14
workflowType: "create-ux-design"
project_name: "Nerve"
user_name: "Opsa"
date: "2026-04-05"
status: "completed"
inputDocuments:
  - "/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/prd.md"
  - "/home/opsa/Work/Nerve/_bmad-output/planning-artifacts/research/technical-nerve-rag-assistant-research-2026-04-05.md"
  - "/home/opsa/Work/Nerve/docs/index.md"
  - "/home/opsa/Work/Nerve/docs/project-overview.md"
  - "/home/opsa/Work/Nerve/docs/component-inventory-web-client.md"
  - "/home/opsa/Work/Nerve/src/App.tsx"
  - "/home/opsa/Work/Nerve/src/components/AppLayout.tsx"
  - "/home/opsa/Work/Nerve/src/components/AppSidebar.tsx"
  - "/home/opsa/Work/Nerve/src/pages/AIQuery.tsx"
  - "/home/opsa/Work/Nerve/src/pages/Browse.tsx"
  - "/home/opsa/Work/Nerve/src/pages/AINewsletter.tsx"
---

# UX Design Specification - Nerve RAG Assistant

**Author:** Opsa  
**Date:** 2026-04-05

## Executive Summary

Nerve needs to replace the current `src/pages/AIQuery.tsx` local keyword fallback with a production-ready assistant that feels native to the existing application shell, respects role- and team-aware access rules, and helps users both find documents and understand them. The assistant should behave like one trusted knowledge workspace rather than a generic chatbot.

The UX must prioritize trust over fluency. Every substantive answer needs citations. Every source card, snippet, and open action must reflect only what the current user is allowed to access. When evidence is weak, the interface must clearly abstain instead of producing a polished answer. When the user intent is retrieval-oriented, the page should behave like search. When the user intent is synthesis-oriented, the page should behave like an evidence-backed assistant.

### Product Goals

- Replace the existing `/ai/query` experience without changing Nerve's main app shell or auth model.
- Support `Auto`, `Search`, and `Ask` modes in one unified page.
- Return grounded answers with clickable citations and source previews.
- Show search-result style responses for `find`, `show`, `list`, and known-item queries.
- Show answer style responses for summarization, comparison, and question queries.
- Make low-confidence and no-evidence outcomes explicit and useful.
- Support mixed source types: entries, PDFs, documents, and images with OCR text.
- Remain usable on desktop and mobile.

### Experience Principles

- Trust before convenience: never imply certainty without accessible evidence.
- Search and answer are one workflow: users should not decide upfront whether they need a chatbot or a search engine.
- Sources are first-class: evidence inspection is part of the main experience, not a secondary debug path.
- Permission safety is invisible but strict: blocked sources should simply not appear.
- Brownfield fit matters: the page should look and feel like Nerve, not like a separate AI product.

## Information Architecture

### Route And Navigation Placement

- Keep the existing route at `/ai/query` to preserve brownfield compatibility.
- Keep the page inside `AppLayout` and existing `RoleGuard` behavior.
- Recommended sidebar label at launch: change `Ask AI` to `Assistant` while keeping the route stable.
- Keep `Newsletter` as a separate tool; do not merge newsletter generation into the assistant page.

### Page Regions

| Region | Purpose | Notes |
| --- | --- | --- |
| Header | Page identity and secondary actions | Title, helper text, `New conversation`, `Filters`, and role-gated `Add source` action |
| Mode bar | Query intent control | Segmented control for `Auto`, `Search`, `Ask` |
| Main results column | Transcript and result stack | Shows answer cards, search-result groups, state cards, and follow-up suggestions |
| Context rail | Evidence and source detail | Sticky right rail on desktop; sheet or drawer on mobile |
| Composer | Primary input | Sticky bottom composer with query field, send action, and current mode/filter context |

### Core Content Objects

- Query: the user prompt plus selected mode and active facets.
- Response block: one assistant turn rendered as either answer-first, search-first, or no-answer.
- Citation: labeled evidence reference such as `S1`, `S2`, `S3`.
- Source card: accessible result item with metadata, snippet, state, and actions.
- Evidence preview: excerpt, page locator, or OCR-backed snippet tied to a source.
- Session thread: the current in-page conversation transcript.

### Role-Aware Capabilities

| User type | Main experience | Additional controls |
| --- | --- | --- |
| All authenticated users | Query accessible knowledge, inspect citations, open accessible sources | None beyond query, filter, and open actions |
| `admin` / `sub_admin` | Same assistant experience | `Add source` action, upload-state visibility for owned or managed content, management metadata where permitted |
| `super_admin` | Same assistant experience | Broadest source management visibility, but operational diagnostics should still live in a dedicated management surface rather than clutter the main assistant flow |

## Page Layout And Interaction Model

### Desktop Layout

- Use the existing Nerve shell: sidebar on the left, assistant page within the `main` region from `AppLayout`.
- Inside the page content area, use a two-column assistant workspace:
- Main content column: roughly 8 of 12 columns for transcript, answer cards, and result lists.
- Context rail: roughly 4 of 12 columns for evidence details, selected source preview, and source actions.
- Keep the composer sticky to the bottom of the main content column so multi-turn use remains natural.
- Keep the context rail sticky while the user scrolls the transcript so citation clicks never feel disorienting.

### Mobile Layout

- Collapse to a single-column flow beneath the app header.
- Keep the composer sticky at the bottom with safe-area padding.
- Move filters into a full-height `Sheet`.
- Move the evidence rail into a bottom sheet or right-side sheet triggered by citation chips and source cards.
- Keep header actions concise: `Filters`, `New`, and a role-gated overflow action for upload.

### Header

- Title: `Assistant`
- Subtitle: `Search and answer across Nerve knowledge with citations.`
- Primary utilities:
- `New conversation`
- `Filters`
- `Add source` for roles permitted to upload/index knowledge
- When the backend is unavailable, replace the current disconnected warning with a full-width status card that explains what is unavailable and what still works.

### Composer

- Use a multiline input with a minimum height of 2 lines and a maximum height of 6 lines.
- Primary action is `Send`.
- `Enter` submits. `Shift+Enter` creates a new line.
- Show the selected mode directly above or attached to the composer so the user always knows the current behavior.
- Show active filters as removable chips above the composer and keep them persistent across turns until cleared.
- Starter prompt chips should appear only when the thread is empty and should be mode-aware.

## Query Modes And Response Selection

| Mode | User expectation | Default response shape | Notes |
| --- | --- | --- | --- |
| `Auto` | "Decide the best response for me." | Search-style for retrieval intents, answer-style for synthesis intents, mixed when needed | Default mode on page load |
| `Search` | "Help me find sources." | Ranked result list with snippets, type badges, and optional short summary | Best for `find`, `show`, `list`, `which file`, `what documents mention` |
| `Ask` | "Answer from the evidence." | Grounded answer card with inline citations and evidence section | Best for `summarize`, `compare`, `what does`, `why`, `how` |

### Auto Mode Rules

- Queries with retrieval verbs such as `find`, `show`, `list`, `which`, `where`, or explicit file-type nouns should resolve to search-first layout.
- Queries asking for summary, comparison, explanation, or policy understanding should resolve to answer-first layout.
- Ambiguous queries may return a mixed response:
- short grounded answer at the top
- source-result group directly below
- no evidence never becomes a speculative answer

## Primary Flows

### 1. First Visit / Empty State

The user lands on `/ai/query` and sees a calm, search-like empty state instead of an empty chat log. The page should show the mode selector, a short trust statement, and 4 to 6 starter chips such as `Find a policy PDF`, `Summarize attendance guidance`, `Show recent admissions documents`, and `What do the documents say about placement updates?`

### 2. Known-Item Search Flow

The user asks something like `find the PDF about attendance` or `show documents related to admissions`. In `Auto` or `Search`, the assistant returns:

- a compact top summary such as `I found 6 accessible sources`
- ranked source cards with content-type badges and short snippets
- quick facets for narrowing the result set
- open and preview actions that stay within permission boundaries

This flow should feel closer to Nerve's existing browse experience than to chat.

### 3. Grounded Answer Flow

The user asks `summarize what the stored documents say about the 75% attendance rule`. In `Auto` or `Ask`, the assistant returns:

- a concise answer card
- inline citation chips attached to each substantive claim
- a supporting evidence section under the answer
- the selected citation opened in the context rail

The answer should read like a verified summary, not a conversational monologue.

### 4. Citation Inspection Flow

The user clicks a citation chip such as `S2 p.4`. The context rail opens or updates to show:

- source title and type
- page or section locator
- highlighted snippet
- available actions such as `Open source` or `Download`

The clicked citation must remain visibly linked to the active snippet so the user can tell exactly what supports the claim.

### 5. No-Evidence / Low-Confidence Flow

If evidence is weak, inaccessible, or absent, the assistant must stop short of synthesis and show one of two explicit patterns:

- No evidence: `I couldn't find enough evidence in the sources available to you.`
- Low confidence: `I found related material, but not enough support to answer confidently.`

Both states should offer helpful next actions:

- switch to `Search`
- remove filters
- try a document name or department
- review related accessible sources if any exist

### 6. Upload And Indexing Flow

For permitted roles, the page header includes `Add source`. Upload opens a dialog or sheet for PDFs, documents, or images. After submission, the user sees source-state feedback using clear badges:

- `Uploading`
- `Processing`
- `Ready`
- `Failed`
- `Reindexing`

These states should appear in privileged source cards or a compact recent-uploads panel, but not overwhelm the main query experience for everyday users.

## Result Presentation Patterns

### Search-Result Style Response

Use this layout for `find/show/list` intents:

- top summary row with result count and visible active facets
- ranked source cards, 5 items by default
- `Show more results` after the first 5
- optional one-sentence assistant summary when it adds value

#### Source Card Anatomy

- Source icon and content-type badge: `Entry`, `PDF`, `Doc`, `Image`
- Title
- Secondary metadata: department, owner/team when appropriate, date, status
- Snippet or OCR excerpt with matched terms emphasized
- Citation locator where relevant: page, section, or body location
- Actions:
- `Preview`
- `Open source`
- `Download` only when allowed

### Answer Style Response

Use this layout for summarization and question intents:

- answer card with concise prose or bullets
- inline citation chips after each claim or sentence cluster
- evidence block beneath the answer with the cited sources in rank order
- suggested follow-up prompts beneath the evidence block

### Mixed Response

Use this when `Auto` determines the user needs both synthesis and discovery:

- short answer at the top
- supporting source cards immediately below
- label the second section clearly as `Sources used` or `Related sources`

### Evidence Preview By Content Type

| Content type | Default preview behavior | Open behavior |
| --- | --- | --- |
| Entry | Show body excerpt plus metadata such as dept/type/date | Open internal Nerve entry detail or equivalent internal record view |
| PDF | Show page number, heading path, and highlighted excerpt | Open PDF at page where supported |
| Doc / plain text file | Show section heading and excerpt | Open authenticated viewer or download proxy |
| Image | Show thumbnail if available plus OCR excerpt or caption | Open image viewer with text excerpt alongside it |

## Citations And Evidence UX

### Citation Chips

- Use short labels like `S1`, `S2`, `S3` with optional page hints such as `p.4`.
- Chips should appear inline, not only in a footer list.
- Hover or focus shows a short tooltip summary on desktop.
- Click opens the related evidence item in the context rail or sheet.

### Evidence Rail

The evidence rail is the main verification surface. It should contain:

- selected citation preview
- list of all cited sources in the current answer
- source actions
- state badges such as `Ready` or `Processing`

The rail must support keyboard navigation and maintain selection state as the user moves through citations.

### Source Opening Behavior

- `Preview` keeps the user in the assistant context.
- `Open source` opens the underlying document or entry in a new tab or authenticated viewer.
- `Download` is secondary and only shown when permitted and meaningful.

### Permission-Safe Display Rules

- Never show a title, filename, snippet, page count, or citation for a blocked source.
- Do not expose counts that imply hidden documents.
- If access limits make evidence insufficient, use neutral copy such as `in the sources available to you`.
- Do not show disabled buttons for content the user is not allowed to access.

## Filters, Facets, And Search Controls

### Default Controls

- Mode selector: always visible
- Main query input: always visible
- `Filters` button: always visible
- Active filter chips: visible whenever any facet is applied

### Recommended Facets

- Content type: `Entry`, `PDF`, `Doc`, `Image`
- Department
- Date range
- Sort: `Relevance` by default, optional `Newest`

### Privileged Facets

Show these only when the user's role and access scope make them meaningful:

- Team
- Owner
- Visibility scope
- Indexing status: `Processing`, `Ready`, `Failed`

### Filter Behavior

- Desktop: inline filter card or right-side filter panel.
- Mobile: full-height `Sheet`.
- Every active facet becomes a removable chip.
- `Clear all` should be available whenever one or more filters are active.
- Filters persist across turns within the current session until cleared.

## Empty, Loading, Error, And No-Answer States

| State | Trigger | UX treatment |
| --- | --- | --- |
| Empty | No thread yet | Trust statement, starter prompts, mode selector, and optional recent uploads for privileged users |
| Retrieving | Search or retrieval underway | Skeleton result cards plus status text such as `Searching accessible sources...` |
| Generating answer | Evidence found and answer synthesis running | Preserve retrieved sources skeleton and show `Preparing grounded answer...` |
| No results | No accessible matches at all | Neutral empty card with refine suggestions and filter reset action |
| No evidence | Matches are too weak for synthesis | No answer card, explain that evidence is insufficient, optionally show related accessible sources |
| Low confidence | Partial evidence exists but support is weak | Caution card, no definitive answer, highlight related sources and suggested refinements |
| Source processing | Queried or previewed source is not indexed yet | Status badge plus explanation such as `This source is still processing and may not appear in answers yet.` |
| Source failed | Extraction or indexing failed | Failure badge for privileged users, optional retry action where allowed |
| Error | API or model failure | Plain-language error card, preserve user query, allow retry |

### Copy Guidance

- Prefer calm, institutional language over anthropomorphic assistant phrasing.
- Say what happened, what the user can do next, and whether any accessible sources were found.
- Avoid phrases that imply hidden documents exist when the user cannot access them.

## Conversation History Behavior

### MVP Recommendation

- Include transcript history for the current in-page session.
- Include `New conversation` to reset the session while preserving the page route and current mode.
- Do not include multi-session saved thread history in the first production replacement of `AIQuery.tsx`.

This recommendation matches the PRD and technical research, which treat persisted threads and message history as a later-phase capability rather than an MVP requirement.

### Future Extension

If saved history is introduced later:

- desktop: recent conversations rail below the header or as a collapsible secondary column
- mobile: history in a `Sheet`
- show title, time, and last query only
- never auto-open old threads on shared or kiosk-like devices

## Accessibility And Usability Considerations

### Accessibility

- Target WCAG 2.2 AA.
- Maintain strong color contrast for all text and state badges.
- Ensure every interactive control has a visible focus state.
- Support complete keyboard navigation across mode pills, source cards, citation chips, sheets, and dialogs.
- Use `aria-live` regions for retrieval, generation, and indexing status updates.
- Give citation chips descriptive accessible names such as `Citation S2, page 4, Attendance Guidelines 2025`.
- Ensure touch targets are at least 44 by 44 pixels.
- Provide alt text or text equivalents for image previews and OCR-backed source cards.

### Usability

- Default to `Auto` so users do not need to learn the system before getting value.
- Keep the main page visually closer to Nerve's browse patterns than to a blank chatbot canvas.
- Use short, accountable answer lengths by default; let evidence carry depth.
- Preserve the current query and filters after failures so users can retry without retyping.
- Make source verification one click away from every answer.

## Responsive Strategy

- Desktop uses a two-column workspace with a persistent evidence rail.
- Tablet uses a single main column with a collapsible evidence panel.
- Mobile uses a single column with sticky composer, filter sheet, and evidence sheet.
- The page should avoid horizontal scrolling entirely.
- Long source titles and filenames should truncate gracefully with full text available on focus or hover.

## Reuse And Implementation Notes

### Existing Nerve Patterns To Reuse

- `AppLayout` for shell, loading, and error handling
- current route and auth structure from `src/App.tsx`
- `useAuth()` for session and role context
- `src/lib/api.ts` as the assistant API boundary
- `hub-card`, `hub-input`, `hub-badge`, and serif page-heading style from the current UI language
- browse-style filter patterns already used in `Browse.tsx` and `BrandingBrowse.tsx`

### Existing UI Primitives To Prefer

- `Card`, `Badge`, `Tabs`, `Tooltip`, `ScrollArea`, `Accordion`, `Separator`, `Skeleton`
- `Sheet` for mobile filters and evidence drawer
- `Dialog` for upload flow
- `Toast` or `Sonner` for upload or retry confirmation feedback

### New Shared Components Recommended

- `AssistantComposer`
- `AssistantModeToggle`
- `AssistantResponseCard`
- `AnswerCard`
- `SourceCard`
- `EvidencePanel`
- `AssistantFilters`
- `UploadStatusBadge`

### Brownfield Guardrails

- Do not use `useAppData().entries` as the assistant result source once the production assistant is implemented.
- Do not reintroduce the retained Supabase client path for the live assistant runtime.
- Keep permission checks server-authoritative and reflect them in the UI by omission, not by tease-and-block patterns.

## Launch Acceptance Checklist

- The page still lives at `/ai/query` and fits inside the existing Nerve shell.
- `Auto`, `Search`, and `Ask` are understandable without documentation.
- Search-style and answer-style responses feel distinct and intentional.
- Every substantive answer includes clickable citations.
- Evidence can be inspected without leaving the page.
- No-evidence and low-confidence states are explicit and useful.
- Source cards support entries, PDFs, docs, and images.
- Mobile users can query, filter, inspect evidence, and open sources without layout breakage.
- Blocked content is never revealed through source names, snippets, counts, or citation labels.
