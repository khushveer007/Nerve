---
stepsCompleted: ["repo-grounding", "web-research", "synthesis"]
inputDocuments:
  - "/home/opsa/Work/Nerve/docs/project-overview.md"
  - "/home/opsa/Work/Nerve/docs/architecture-api-server.md"
  - "/home/opsa/Work/Nerve/docs/component-inventory-web-client.md"
  - "/home/opsa/Work/Nerve/docs/data-models-api-server.md"
  - "/home/opsa/Work/Nerve/_bmad-output/project-context.md"
workflowType: "research"
lastStep: 6
research_type: "technical"
research_topic: "Production-ready permission-aware RAG assistant for Nerve"
research_goals:
  - "Recommend one brownfield architecture for replacing the current local AI query page with a real RAG assistant"
  - "Design ingestion, extraction, chunking, retrieval, citations, ACL, API, UI, jobs, testing, and rollout strategy"
user_name: "Opsa"
date: "2026-04-05"
web_research_enabled: true
source_verification: true
---

# Technical Research Report: Production-Ready Permission-Aware RAG Assistant for Nerve

**Date:** 2026-04-05  
**Author:** Opsa + Codex research synthesis  
**Project:** Nerve

## Research Overview

This report recommends a production-ready RAG architecture for Nerve's current brownfield runtime:

- Vite/React SPA in `src/`
- Express API in `server/`
- PostgreSQL 16 with `pgvector`
- Session-based auth and role/team access rules
- Active frontend traffic through `/api`
- Current AI UX in `src/pages/AIQuery.tsx` is only local keyword fallback, not true retrieval or generation

The recommendation is intentionally **brownfield-first**:

- It keeps the **Express API as the application boundary**
- It keeps **PostgreSQL as the authoritative content, ACL, and retrieval system**
- It uses **Azure AI Foundry** only for model execution and extraction
- It treats retained Supabase AI code as **reference only**, not runtime architecture

## Repo Grounding

The recommendation is based on the current repository state documented in:

- `docs/project-overview.md`
- `docs/architecture-api-server.md`
- `docs/component-inventory-web-client.md`
- `docs/data-models-api-server.md`
- `_bmad-output/project-context.md`

And on direct inspection of the active code:

- `src/pages/AIQuery.tsx` is a local keyword matcher over `useAppData().entries`
- `src/hooks/useAppData.tsx` loads shared data from `/api/bootstrap`
- `server/index.ts` exposes session-authenticated REST routes and already contains a `multer`-based image upload path for branding
- `server/db.ts` enables `vector` in PostgreSQL but does not yet define vector-backed retrieval tables
- `server/index.ts` serves `/uploads` statically, which is acceptable for public branding images but is **not safe** for permission-aware document retrieval

## Executive Recommendation

The best production-ready architecture for Nerve is:

**App-managed hybrid RAG inside the existing Express/PostgreSQL stack, with PostgreSQL as the retrieval engine and ACL authority, Azure AI Foundry for generation and embeddings, and Mistral Document AI for OCR/extraction.**

In practical terms:

1. Keep all user-facing assistant requests going through the existing Express server.
2. Store uploaded binaries outside public static serving, behind authenticated download/proxy endpoints.
3. Normalize all retrievable knowledge into PostgreSQL tables for:
   - assets/documents
   - versions/extractions
   - chunks
   - ACL principals
   - ingestion jobs
   - optional assistant conversations/messages/citations
4. Use a **hybrid retrieval** pipeline:
   - exact metadata match
   - PostgreSQL full-text search
   - trigram filename/title matching
   - `pgvector` semantic similarity
   - ACL filtering in SQL before final candidate selection
5. Use **gpt-4.1-mini** for grounded answer generation, **gpt-4.1-nano** for low-cost query classification/fallback tasks, and **text-embedding-3-small** for embeddings.
6. Use **mistral-document-ai-2512** as the default OCR/extraction model and **mistral-document-ai-2505** as the fallback extractor.

This is the best fit for Nerve because it:

- matches the current API-backed runtime
- preserves existing session auth and role/team logic
- avoids duplicating source-of-truth permissions into a second primary search system
- uses the already-enabled PostgreSQL + `pgvector` foundation
- lets you roll out in phases, starting from existing `entries`

## 1. Best Production-Ready RAG Architecture for This Repository

### Recommended architecture

Use a **three-layer brownfield architecture**:

1. **Application layer**
   - React SPA page replaces `src/pages/AIQuery.tsx`
   - Express routes handle uploads, search, chat, citations, downloads, and admin/job status

2. **Knowledge pipeline layer**
   - ingestion worker process in the same repo/runtime family
   - PostgreSQL-backed job queue
   - OCR/extraction, normalization, chunking, embedding, indexing, reindexing

3. **Retrieval/generation layer**
   - PostgreSQL stores authoritative chunks, metadata, and ACL
   - `pgvector` stores embeddings
   - PostgreSQL full-text search stores exact/keyword search vectors
   - Azure AI Foundry models perform generation and embeddings

### Why this is better than the main alternatives

**Better than Azure AI Search as the primary engine for Nerve**

- Nerve already stores auth, sessions, teams, ownership, and app content in PostgreSQL.
- Azure AI Search hybrid search is strong, but it introduces another primary retrieval store and another ACL synchronization problem.
- Azure AI Search security filtering still requires pushing permission strings into the index and filtering at query time; Microsoft documents this as a security filter pattern, and even their newer document-level ACL support is still a separate indexing model rather than your app's existing authorization system.[8][9][10]
- For Nerve's size and brownfield needs, PostgreSQL is the simpler authoritative place to enforce permission joins.

**Better than model-managed "upload files and prompt them" pseudo-RAG**

- It preserves ACL and ownership checks
- It supports citations
- It scales to mixed sources and reindexing
- It avoids stuffing full files into prompts

**Better than a pure keyword search upgrade**

- Nerve needs semantic retrieval, grounded summarization, and mixed-content search
- Queries like "show documents related to admissions" or "summarize what the stored documents say about X" need chunked semantic retrieval and evidence synthesis

## 2. Ingestion Pipeline for Plain Text, Uploaded Files, PDFs, and Images

### Recommended ingestion entry points

#### A. Plain text already stored in the app

Sources:

- `entries.title`
- `entries.body`
- `entries.tags`
- metadata fields like `dept`, `type`, `priority`, `author_name`, `academic_year`
- optionally selected branding knowledge tables later, if product scope expands

Flow:

1. Entry create/update/delete happens through Express.
2. Server writes the business record normally.
3. Server upserts a `knowledge_asset` record linked to `entries.id`.
4. A background job performs normalization, chunking, embedding, and indexing.

#### B. Uploaded files

Sources:

- PDFs
- images
- office/text documents that users upload

Flow:

1. User uploads via authenticated Express endpoint.
2. File is stored in non-public storage.
3. Server creates a `knowledge_asset` record with metadata, ownership, and ACL envelope.
4. Server enqueues extraction job.
5. Worker runs Mistral extraction, normalization, chunking, embeddings, indexing.

### Storage recommendation

For production, do **not** reuse the current public `/uploads` static-serving pattern from `server/index.ts` for RAG documents.

Use:

- **production:** Azure Blob Storage or another private object store
- **development:** local disk storage adapter

Then serve documents through:

- authenticated proxy download endpoint, or
- short-lived signed URLs issued only after ACL verification

This is an important brownfield correction because the current branding image flow is public-by-path, while the new assistant must be permission-aware.

## 3. Extraction and Normalization Workflow

### Recommended extractor policy

#### Default extraction

- **Primary:** `mistral-document-ai-2512`
- **Fallback:** `mistral-document-ai-2505`

Reason:

- Microsoft Foundry's model catalog describes `mistral-document-ai-2512` as an improved OCR/document model that returns structured text for PDFs and images, supports markdown output, annotations, and configurable table extraction.[4]
- Microsoft Foundry's model catalog describes `mistral-document-ai-2505` as the earlier document OCR fallback for PDF/image extraction and structured output.[5]

### Important constraint

The Foundry catalog for `mistral-document-ai-2512` lists a current limit of **30 MB and 30 pages** per document on Foundry.[4]

The same model card also marks `mistral-document-ai-2512` as a **Preview** offering on Foundry.[4]

Therefore the pipeline should support:

- page-splitting for large PDFs
- multi-part extraction jobs
- merge-back into one normalized asset version
- retrying only failed page ranges
- extractor abstraction so Nerve can fall back to `mistral-document-ai-2505` or swap extractor versions without changing the rest of the pipeline

### Normalization workflow

For every source, produce a canonical normalized form:

1. **Source capture**
   - original business metadata
   - storage location
   - checksum
   - source type

2. **Extraction output**
   - extracted markdown
   - page-level text
   - layout metadata
   - table blocks
   - optional bbox/image annotations

3. **Normalization**
   - remove duplicated headers/footers where safe
   - fix dehyphenation across line breaks
   - preserve heading hierarchy
   - preserve page numbers
   - preserve table structure in markdown or HTML
   - generate searchable caption/summary when image OCR text is sparse

4. **Canonical text representation**
   - one normalized text stream per version
   - page-local sections retained
   - chunk-ready structural blocks

### Images

Because your required embedding model is text-only (`text-embedding-3-small`), image retrieval in Nerve should be implemented as:

- OCR text from the image/poster
- filename/title/tags metadata
- optional short caption/annotation text for image-only meaning

This means Nerve will support **text-grounded image retrieval**, not native image-image similarity search.

## 4. Chunking Strategy, Metadata Model, and PostgreSQL/pgvector Schema

### Recommended chunking strategy

Use **document-aware chunking**, not fixed-size blind splitting.

#### Plain text entries

- often 1 to 3 chunks per entry
- chunk by paragraph/section boundaries
- always include title + key metadata in the first chunk

#### PDFs and documents

- chunk by heading, section, or page-local block
- target about **350 to 700 tokens**
- use **60 to 120 token overlap** only when a section spans chunks
- keep tables as single units when small enough
- keep page references attached to each chunk

#### Images/posters

- one OCR/caption chunk for small assets
- multiple chunks only if extracted text is substantial

### Recommended metadata model

Use a **generic knowledge-asset model** instead of bolting vectors directly onto `entries`.

That gives one retrieval system across:

- app text records
- uploaded files
- PDFs
- images

### Recommended PostgreSQL schema

#### `knowledge_assets`

Authoritative record for every retrievable thing.

Suggested columns:

- `id`
- `source_kind` (`entry`, `uploaded_file`, `branding_record`, future values)
- `source_table`
- `source_id`
- `title`
- `file_name`
- `mime_type`
- `media_type` (`text`, `pdf`, `image`, `doc`)
- `storage_backend`
- `storage_key`
- `sha256`
- `size_bytes`
- `owner_user_id`
- `owner_team_id`
- `visibility_scope` (`authenticated`, `team`, `owner`, `explicit_acl`)
- `status` (`pending`, `ready`, `failed`, `deleted`)
- `created_by`
- `created_at`
- `updated_at`

#### `knowledge_asset_versions`

Tracks the extracted/indexed version of an asset.

Suggested columns:

- `id`
- `asset_id`
- `version_no`
- `source_hash`
- `extractor_model`
- `extraction_status`
- `normalized_markdown`
- `normalized_text`
- `page_count`
- `language_code`
- `structural_metadata JSONB`
- `created_at`

#### `knowledge_chunks`

Stores retrieval-ready chunks.

Suggested columns:

- `id`
- `asset_version_id`
- `asset_id`
- `chunk_no`
- `chunk_type` (`body`, `table`, `caption`, `summary`, `metadata`)
- `heading_path TEXT[]`
- `page_from`
- `page_to`
- `char_start`
- `char_end`
- `token_count`
- `content TEXT`
- `search_vector TSVECTOR`
- `embedding VECTOR(1536)`
- `metadata JSONB`
- `citation_locator JSONB`
- `created_at`

#### `knowledge_acl_principals`

Explicit allow-list rows when `visibility_scope = 'explicit_acl'`.

Suggested columns:

- `id`
- `asset_id`
- `principal_type` (`user`, `team`, `role`)
- `principal_id`
- `permission` (`read`)
- `created_at`

#### `knowledge_jobs`

Suggested columns:

- `id`
- `asset_id`
- `asset_version_id`
- `job_type` (`extract`, `normalize`, `chunk`, `embed`, `reindex`, `delete`)
- `status` (`queued`, `running`, `succeeded`, `failed`, `dead_letter`)
- `attempt_count`
- `run_after`
- `locked_at`
- `worker_id`
- `last_error`
- `created_at`
- `updated_at`

#### Optional assistant persistence tables

- `assistant_threads`
- `assistant_messages`
- `assistant_message_citations`

### Indexing recommendations

Use:

- `CREATE EXTENSION IF NOT EXISTS vector`
- `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- GIN index on `search_vector`
- HNSW index on `embedding`
- B-tree indexes on ACL/ownership/filter fields
- trigram GIN or GiST indexes on `title`, `file_name`, and possibly `tags_text`

Why:

- PostgreSQL full-text search uses GIN/GiST indexes for `tsvector` search.[6]
- PostgreSQL's text search docs support weighted vectors with `setweight(...)` and concatenation, which is exactly what Nerve needs for title/body/metadata weighting.[7]
- `pgvector` supports exact and approximate nearest-neighbor search, HNSW, filtering guidance, and hybrid search with Postgres full-text search.[11]
- PostgreSQL `pg_trgm` supports indexed similarity, `LIKE`, `ILIKE`, and fuzzy matching for filenames/titles.[12]

### Search vector weighting

Recommended pattern:

- Title / file name / tags: weight `A`
- headings / summaries / department / type: weight `B`
- main chunk content: weight `C`
- low-value OCR residue or footer text: weight `D`

## 5. Hybrid Retrieval Approach

### Recommended retrieval stack

Use **four concurrent candidate generators**:

1. **Metadata/exact match**
   - filename
   - title
   - dept
   - type
   - tags
   - asset kind

2. **PostgreSQL full-text search**
   - `websearch_to_tsquery(...)`
   - weighted `ts_rank_cd(...)`

3. **Trigram/title matching**
   - for misspellings, partial filenames, and short entity-like searches

4. **Vector search**
   - embed user query with `text-embedding-3-small`
   - retrieve chunk candidates via HNSW cosine or inner-product search

### Recommended ranking strategy

Use **candidate union + Reciprocal Rank Fusion (RRF)** with deterministic boosts:

- boost exact filename/title matches
- boost ACL-safe chunks from matching asset types
- lightly boost recent versions only when content recency matters
- collapse adjacent chunks from the same asset before answer synthesis

This is aligned with:

- Azure AI Search's own hybrid-search explanation that hybrid search combines text and vector results and fuses them with Reciprocal Rank Fusion.[8]
- pgvector's own README guidance that hybrid search should combine vector search with PostgreSQL full-text search and can use RRF.[11]

### Query planner behavior

Support `mode: "auto" | "chat" | "search"`.

Recommended planner:

- deterministic first-pass intent rules for verbs like `find`, `show`, `list`, `which file`, `what files mention`
- optional low-cost classifier with `gpt-4.1-nano` only when intent is ambiguous

#### Search mode

Return:

- ranked assets
- snippets
- metadata
- citations/locators
- optional 1-paragraph summary

#### Chat mode

Return:

- grounded synthesis
- explicit citations
- "not enough evidence" when support is weak

### SQL filtering note

Because pgvector notes that ANN filtering is applied after approximate index scan and can lose recall under filters, Nerve should:

- keep strong B-tree prefilters on ACL and common metadata fields
- increase `hnsw.ef_search` for filtered queries
- enable iterative scans where needed

This is explicitly discussed in pgvector's filtering and iterative-scan guidance.[11]

## 6. How Citations and Source References Should Be Stored and Returned

### Store citations at chunk level

Each chunk should carry a `citation_locator` JSON object such as:

```json
{
  "asset_id": "asset_123",
  "asset_version_id": "ver_5",
  "chunk_id": "chunk_90",
  "title": "Attendance Guidelines 2025",
  "file_name": "attendance-guidelines.pdf",
  "source_kind": "uploaded_file",
  "page_from": 4,
  "page_to": 4,
  "heading_path": ["Section 3", "Minimum Attendance"],
  "char_start": 1023,
  "char_end": 1488
}
```

### Return citations in two forms

#### A. Human-facing citation list

For the UI:

- `S1`, `S2`, `S3`
- title
- file/entry type
- page number if present
- matching snippet
- action link (`view`, `download`, `open source`)

#### B. Machine-facing references

For follow-up turns and audit:

- chunk ids
- asset ids
- version ids
- page locators
- evidence excerpts

### Persist answer citations

If conversations are stored, persist every answer's evidence rows in `assistant_message_citations`:

- `message_id`
- `citation_label`
- `chunk_id`
- `asset_id`
- `asset_version_id`
- `page_from`
- `page_to`
- `excerpt`
- `rank`

This makes audits, debugging, and regression tests much easier.

## 7. How Access Control Should Be Enforced During Indexing and Retrieval

### Core rule

**Permissions must be enforced authoritatively at retrieval time, not just encoded during indexing.**

Index-time ACL metadata is useful for speed. It is not enough for correctness.

### Recommended model

For each asset:

- store ownership snapshot
- store visibility scope
- optionally store explicit ACL principals

At query time:

1. resolve current session user
2. resolve current role/team
3. build allowed principal set
4. apply SQL joins/filters to assets before final result assembly

### Brownfield compatibility rule

Current Nerve behavior appears to make regular `entries` broadly available to authenticated users, while branding-specific features are gated separately through route logic.

Therefore:

- existing `entries` should default to `visibility_scope = 'authenticated'`
- newer uploads can use `team`, `owner`, or `explicit_acl`
- RAG should not silently introduce stricter access than current product behavior without an explicit product decision

### Permission change handling

When ownership/team/ACL changes:

- update the authoritative asset row immediately
- enqueue `reindex_acl` or `rebuild_search_doc` job
- retrieval must already respect the new ACL from the authoritative tables even if embeddings are not yet recomputed

### File access handling

Never expose private RAG assets from a public static directory.

Every file open/download should go through:

- session auth check
- ACL check
- streamed proxy or short-lived signed URL

## 8. Background Jobs, Retries, Re-indexing, and Failure Handling

### Recommended worker model

Use a **PostgreSQL-backed job queue** first.

Why this fits Nerve:

- one existing database
- one Node/Express runtime family
- no separate queue infrastructure required for phase 1
- easy transactional enqueueing from API writes

Suggested pattern:

- queue table in PostgreSQL
- worker polls with `FOR UPDATE SKIP LOCKED`
- optional `LISTEN/NOTIFY` wake-ups

### Required job types

- `extract_asset`
- `normalize_asset`
- `chunk_asset`
- `embed_chunks`
- `reindex_asset`
- `delete_asset_index`
- `refresh_acl_projection`
- `reprocess_failed_asset`

### Retry policy

- idempotent jobs
- exponential backoff
- hard cap on attempts
- dead-letter status with operator-visible error

### Re-index triggers

- entry text changed
- file replaced
- OCR extractor changed
- chunking policy changed
- embedding model changed
- ACL metadata changed
- deletion/tombstoning

### Failure handling

#### Extraction failure

- asset remains stored
- status becomes `failed`
- UI shows "processing failed"
- admin or creator can retry

#### Partial PDF failure

- keep page-range status
- retry failed ranges only

#### Embedding failure

- asset searchable by metadata/FTS if extraction succeeded
- mark semantic index incomplete

## 9. API Changes Needed in the Express Server

### Architectural recommendation for the server codebase

Do **not** keep expanding `server/db.ts` and `server/index.ts` with all RAG logic.

Add a dedicated module family such as:

- `server/rag/routes.ts`
- `server/rag/service.ts`
- `server/rag/retrieval.ts`
- `server/rag/ingestion.ts`
- `server/rag/acl.ts`
- `server/rag/storage.ts`
- `server/rag/jobs.ts`
- `server/rag/db.ts`

This keeps the brownfield app maintainable without pretending it is a greenfield rewrite.

### Recommended endpoints

#### Assistant

- `POST /api/assistant/query`
- optional later: `POST /api/assistant/query/stream`
- `GET /api/assistant/threads`
- `GET /api/assistant/threads/:id`

#### Search

- `POST /api/search/query`
- `GET /api/search/sources/:assetId`

#### Upload and document management

- `POST /api/knowledge/uploads`
- `POST /api/knowledge/assets`
- `GET /api/knowledge/assets`
- `GET /api/knowledge/assets/:id`
- `DELETE /api/knowledge/assets/:id`
- `POST /api/knowledge/assets/:id/reindex`
- `GET /api/knowledge/assets/:id/download`

#### Admin/ops

- `GET /api/knowledge/jobs`
- `GET /api/knowledge/jobs/:id`

### Request/response shape for assistant query

Recommended request:

```json
{
  "mode": "auto",
  "threadId": "optional",
  "query": "what files mention 75% attendance?",
  "filters": {
    "assetKinds": ["pdf", "entry", "image"],
    "departments": [],
    "teams": [],
    "owners": []
  }
}
```

Recommended response:

```json
{
  "mode": "search",
  "answer": "I found 3 sources that mention 75% attendance.",
  "citations": [
    {
      "label": "S1",
      "assetId": "asset_1",
      "title": "Attendance Guidelines 2025",
      "fileName": "attendance-guidelines.pdf",
      "pageFrom": 4,
      "snippet": "Students must maintain a minimum attendance of 75%..."
    }
  ],
  "results": [
    {
      "assetId": "asset_1",
      "title": "Attendance Guidelines 2025",
      "kind": "pdf",
      "score": 0.91
    }
  ],
  "grounded": true,
  "enoughEvidence": true
}
```

## 10. Frontend Changes Needed to Replace the Current AI Query Page

### Replace `src/pages/AIQuery.tsx` with a real assistant page

The new page should support both:

- **chat assistant**
- **natural-language search assistant**

### Recommended UX

#### Main layout

- query composer at bottom or top
- results/answer area above
- mode pill: `Auto`, `Search`, `Ask`
- filter drawer
- evidence panel

#### Search-first behaviors

For queries like:

- "find the PDF about attendance"
- "show documents related to admissions"
- "find the image/poster related to event registration"

Prefer:

- result list cards
- snippets
- content type badges
- source actions

#### Chat behaviors

For queries like:

- "summarize what the stored documents say about X"
- "what files mention 75% attendance?"

Prefer:

- grounded answer
- evidence list beneath answer
- follow-up chips

### Required UI elements

- citation chips that open source document/entry
- evidence drawer showing snippets/pages
- asset-type filters
- ingestion state badges: `processing`, `ready`, `failed`
- clear "not enough evidence" state
- optional thread history

### Reuse points in existing frontend

Use:

- existing `AppLayout` and route/access structure
- `useAuth()` for session/user context
- `src/lib/api.ts` as the API boundary
- existing UI primitives in `src/components/ui/`

Avoid:

- reusing retained Supabase client path
- broadening `src/lib/db.ts`

## 11. Trade-offs Between the Strongest Options

### Option A: PostgreSQL-native hybrid RAG inside Nerve

#### Pros

- best brownfield fit
- single source of truth for content and ACL
- lowest architecture sprawl
- easiest to phase in from current `entries`
- easier auditing of citations and permissions

#### Cons

- more retrieval tuning work in app code
- fewer managed search features than Azure AI Search
- requires careful SQL/index design as corpus grows

### Option B: Azure AI Search as primary retrieval store

#### Pros

- strong built-in hybrid search experience
- mature search-specific operational tooling
- good if corpus becomes very large or heavily externalized

#### Cons

- duplicates data and ACL state outside Nerve's primary DB
- requires separate indexing pipeline and search schema
- security filtering still requires separate index metadata for principal ids, unless using newer search ACL features that are still separate from Nerve's current app auth model and may be preview-dependent.[9][10]
- higher operational surface area for this repo

### Option C: Minimal RAG over `entries` only

#### Pros

- fastest to build
- lowest initial cost

#### Cons

- fails the product requirement for uploaded documents, PDFs, and images
- does not solve the real brownfield roadmap

### Recommendation

Recommend **Option A** now.

Keep **Option B** only as a future escalation path if:

- the corpus grows well beyond what a single PostgreSQL retrieval tier handles comfortably
- you need cross-system enterprise search outside Nerve's primary database
- you are willing to accept a more complex ACL synchronization model

## 12. Phased Implementation Roadmap

### Phase 1: Foundation on existing `entries`

Goal:

- replace fake AI with real retrieval over current app text

Scope:

- new RAG schema for assets/chunks/jobs
- ingest `entries` text only
- embeddings with `text-embedding-3-small`
- hybrid retrieval over entry text + metadata
- new `/api/assistant/query`
- new AI page with citations and no-answer behavior

Outcome:

- immediate value with minimal file pipeline risk

### Phase 2: Private upload pipeline for PDFs, docs, and images

Goal:

- support uploaded documents and images safely

Scope:

- storage abstraction
- private upload endpoints
- OCR/extraction worker with `mistral-document-ai-2512`
- fallback to `mistral-document-ai-2505`
- chunking and citations for PDFs/images
- authenticated file access

Outcome:

- real mixed-content assistant

### Phase 3: Permission-aware asset management

Goal:

- make uploads/documents first-class content with ACL

Scope:

- asset list/detail screens
- owner/team/ACL controls
- reindex controls
- failure/retry visibility

Outcome:

- production operations model for knowledge ingestion

### Phase 4: Quality and relevance tuning

Goal:

- improve relevance, latency, and answer quality

Scope:

- query planner tuning
- RRF weighting
- threshold tuning for no-answer
- optional nano-based query rewrite/classification
- corpus-specific dictionaries/synonyms

### Phase 5: Conversation memory and analytics

Goal:

- mature assistant workflow

Scope:

- saved threads
- message citations persistence
- operator dashboards
- evaluation harness

## 13. Main Risks

### Cost

Risks:

- OCR cost on large document batches
- embedding cost on reindexing
- generation cost if chat is used heavily

Mitigations:

- hash-based dedupe before reprocessing
- batch embeddings
- use `gpt-4.1-nano` for low-value planner tasks
- reindex only changed assets

### Latency

Risks:

- OCR is asynchronous and can timeout on annotation-heavy documents
- hybrid retrieval + generation can feel slow

Mitigations:

- async ingestion
- fast search-mode responses
- cached query embeddings
- tuned HNSW settings
- optional streaming later

### Relevance quality

Risks:

- over-chunking
- OCR noise
- weak filename-only hits outranking real content

Mitigations:

- document-aware chunking
- weighted ranking
- exact-match boosts only when evidence exists
- evaluation set with real Nerve queries

### Permission leakage

Risks:

- public file URLs
- stale ACL projections
- returning citation metadata for blocked documents

Mitigations:

- no public serving of private assets
- retrieval-time authoritative ACL check
- signed URL or proxy downloads only
- ACL regression tests

### Operational complexity

Risks:

- worker failures
- reindex drift
- schema sprawl
- extractor instability or behavior changes while `mistral-document-ai-2512` remains preview on Foundry

Mitigations:

- dedicated `server/rag/*` modules
- job status tables
- dead-letter handling
- operator screens/logging
- extractor abstraction with controlled fallback to `mistral-document-ai-2505`

## 14. Testing, Observability, and Evaluation Strategy

### Testing

#### Unit tests

- chunking logic
- normalization logic
- ACL resolution logic
- ranking fusion helpers
- no-answer threshold logic

#### Integration tests

- upload -> extract -> chunk -> embed -> searchable
- entry update -> reindex
- permission changes -> retrieval changes
- citations map to real source locators

#### Security tests

- blocked user cannot retrieve protected chunk
- blocked user cannot open cited asset
- blocked user cannot infer protected filenames through citations

#### E2E tests

- login -> ask search question -> open cited PDF
- upload PDF -> processing completes -> searchable
- upload image/poster -> OCR text is searchable

### Observability

Track:

- request latency by stage
- extraction success/failure rate
- embedding throughput
- retrieval latency
- top-k result counts
- no-answer rate
- citation coverage rate
- token and model cost per request
- dead-letter job count

### Evaluation set

Create a seed corpus and a golden query set with:

- exact filename queries
- semantic topic queries
- PDF page-specific queries
- poster/image OCR queries
- no-answer queries
- ACL-sensitive queries

Measure:

- Recall@k
- MRR / nDCG for search
- citation precision
- answer groundedness
- abstain precision for no-answer cases
- permission-leak false positive rate

## Model and Platform Notes

### Azure generation/runtime

- Azure's Responses API currently supports `gpt-4.1-mini` and `gpt-4.1-nano`.[1]
- `gpt-4.1-mini` should be the default answer-generation model.
- `gpt-4.1-nano` should be reserved for low-cost planner tasks and fallbacks.

### Azure embeddings

- Azure's model docs list `text-embedding-3-small` and note improved retrieval benchmarks over older embedding models plus support for a `dimensions` parameter.[2]
- Microsoft also documents `text-embedding-3-small` with a default/max output size of **1536 dimensions**.[2]
- For Nerve, start with **full 1536 dimensions** for simplicity and recall, then optimize later only if storage pressure becomes real.

## Recommended No-Answer Policy

Nerve should have **server-enforced abstention**, not prompt-only abstention.

Recommended rule:

- If retrieval returns fewer than a minimum number of evidence chunks, or only low-confidence matches, do not ask the model to synthesize a confident answer.
- Return either:
  - "I couldn't find enough evidence in the documents I can access."
  - or a search-result list without a narrative answer

Prompt the model to:

- answer only from provided evidence
- cite every substantive claim
- say evidence is insufficient when support is weak

## Final Recommendation for Nerve

### Recommended architecture

Build a **PostgreSQL-native, ACL-aware hybrid RAG layer inside the existing Express app**, with:

- Express as the orchestration/API boundary
- PostgreSQL as authoritative content, ACL, chunk, citation, and retrieval store
- `pgvector` + PostgreSQL FTS + trigram matching for hybrid retrieval
- Azure AI Foundry for generation and embeddings
- Mistral Document AI for OCR/document extraction
- non-public file storage with authenticated access

### Recommended data model changes

Add:

- `knowledge_assets`
- `knowledge_asset_versions`
- `knowledge_chunks`
- `knowledge_acl_principals`
- `knowledge_jobs`
- optional `assistant_threads`, `assistant_messages`, `assistant_message_citations`

Keep current business tables intact, especially `entries`, and link them into the knowledge layer through `source_table/source_id`.

### Recommended ingestion and retrieval workflow

1. Capture business record or file upload.
2. Store asset metadata and ACL envelope.
3. Extract text/structure with `mistral-document-ai-2512`, fallback `mistral-document-ai-2505`.
4. Normalize into canonical markdown/text.
5. Chunk by document structure.
6. Embed with `text-embedding-3-small`.
7. Index weighted FTS vectors and HNSW vector index.
8. Retrieve with metadata + FTS + trigram + vector + ACL filters.
9. Generate only from evidence using `gpt-4.1-mini`.
10. Return citations and abstain when evidence is weak.

### Recommended API and UI integration approach

- replace `src/pages/AIQuery.tsx` with a real assistant page supporting `Auto`, `Search`, and `Ask`
- add dedicated `/api/assistant/*` and `/api/knowledge/*` endpoints
- keep auth/session/role checks inside the existing Express model
- do not use public static file paths for private assistant documents

### Recommended phased implementation roadmap

1. Real RAG over existing `entries`
2. Private uploads + OCR for PDFs/docs/images
3. Asset ACL management and operations
4. Relevance tuning and no-answer calibration
5. Conversation persistence, analytics, and evaluation maturity

## Sources

### Repo sources

- Nerve docs and code in this repository, especially:
  - `docs/project-overview.md`
  - `docs/architecture-api-server.md`
  - `docs/component-inventory-web-client.md`
  - `docs/data-models-api-server.md`
  - `_bmad-output/project-context.md`
  - `src/pages/AIQuery.tsx`
  - `src/hooks/useAppData.tsx`
  - `server/index.ts`
  - `server/db.ts`

### External primary sources

[1] Microsoft Learn, "Use the Azure OpenAI Responses API"  
https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses

[2] Microsoft Learn, "Azure OpenAI in Azure AI Foundry Models"  
https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models

[3] Microsoft Learn, "Tutorial: Explore Azure OpenAI embeddings and document search"  
https://learn.microsoft.com/en-us/azure/ai-services/openai/tutorials/embeddings

[4] Microsoft Foundry Model Catalog, "mistral-document-ai-2512"  
https://ai.azure.com/catalog/models/mistral-document-ai-2512

[5] Microsoft Foundry Model Catalog, "mistral-document-ai-2505"  
https://ai.azure.com/catalog/models/mistral-document-ai-2505

[6] PostgreSQL docs, "Preferred Index Types for Text Search"  
https://www.postgresql.org/docs/16/textsearch-indexes.html

[7] PostgreSQL docs, "Additional Text Search Features"  
https://www.postgresql.org/docs/current/textsearch-features.html

[8] Microsoft Learn, "Hybrid search using vectors and full text in Azure AI Search"  
https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview

[9] Microsoft Learn, "Security filters for trimming results in Azure AI Search"  
https://learn.microsoft.com/en-us/azure/search/search-security-trimming-for-azure-search

[10] Microsoft Learn, "Document-level access control in Azure AI Search"  
https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview

[11] pgvector official README  
https://github.com/pgvector/pgvector

[12] PostgreSQL docs, "`pg_trgm` support for similarity of text using trigram matching"  
https://www.postgresql.org/docs/current/pgtrgm.html
