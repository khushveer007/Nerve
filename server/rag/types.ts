export type KnowledgeAssetStatus = "pending" | "processing" | "ready" | "failed" | "deleted";
export type KnowledgeJobStatus = "queued" | "running" | "succeeded" | "failed" | "dead_letter";
export type KnowledgeJobType = "extract" | "normalize" | "chunk" | "embed" | "reindex" | "delete";
export type KnowledgeVisibilityScope = "authenticated" | "team" | "owner" | "explicit_acl";
export type AssistantQueryMode = "auto" | "search" | "ask";

export interface AssistantQueryFilters {
  departments: string[];
  entry_types: string[];
  priorities: string[];
  tags: string[];
}

export interface AssistantQueryInput {
  mode: AssistantQueryMode;
  text: string;
  filters: AssistantQueryFilters;
}

export interface EntryKnowledgeMetadata {
  source_kind: "entry";
  entry_id: string;
  dept: string;
  type: string;
  tags: string[];
  entry_date: string;
  academic_year: string;
  author_name: string;
  created_by: string | null;
  priority: string;
  student_count: number | null;
  external_link: string;
  collaborating_org: string;
}

export interface CitationLocator {
  asset_id: string;
  asset_version_id: string;
  chunk_id: string;
  title: string;
  source_kind: "entry";
  page_from: number | null;
  page_to: number | null;
  heading_path: string[];
  char_start: number;
  char_end: number;
}

export interface AssistantEntrySearchResult {
  asset_id: string;
  asset_version_id: string;
  chunk_id: string;
  entry_id: string;
  title: string;
  source_kind: "entry";
  media_type: "text";
  snippet: string;
  score: number;
  metadata: EntryKnowledgeMetadata;
  citation_locator: CitationLocator;
}

export interface AssistantCitation {
  label: string;
  asset_id: string;
  title: string;
  source_kind: "entry";
  snippet: string;
  citation_locator: CitationLocator;
}

export interface AssistantQueryResult {
  mode: "search" | "ask";
  answer: null;
  enough_evidence: boolean;
  grounded: boolean;
  citations: AssistantCitation[];
  results: AssistantEntrySearchResult[];
  follow_up_suggestions: string[];
  request_id: string;
}

export interface AssistantHealthSnapshot {
  ready_assets: number;
  queued_jobs: number;
  running_jobs: number;
}

export interface AssistantHealthResponse {
  available: boolean;
  title: string;
  description: string;
  nextStep: string;
}

export interface ChunkSeed {
  chunk_no: number;
  chunk_type: "body" | "metadata";
  heading_path: string[];
  char_start: number;
  char_end: number;
  token_count: number;
  content: string;
  metadata: Record<string, unknown>;
  citation_locator: Omit<CitationLocator, "asset_id" | "asset_version_id" | "chunk_id" | "title">;
}

export interface EntryChunkDocument {
  metadata: EntryKnowledgeMetadata;
  normalized_markdown: string;
  normalized_text: string;
  structural_metadata: Record<string, unknown>;
  source_hash: string;
  chunks: ChunkSeed[];
}

export interface KnowledgeAssetRecord {
  id: string;
  source_kind: string;
  source_table: string;
  source_id: string;
  title: string;
  status: KnowledgeAssetStatus;
  visibility_scope: KnowledgeVisibilityScope;
  metadata: EntryKnowledgeMetadata;
}

export interface KnowledgeAssetVersionRecord {
  id: string;
  asset_id: string;
  version_no: number;
  source_hash: string;
  extraction_status: string;
  superseded_at: string | null;
}

export interface KnowledgeJobRecord {
  id: string;
  asset_id: string;
  asset_version_id: string | null;
  job_type: KnowledgeJobType;
  status: KnowledgeJobStatus;
  attempt_count: number;
  run_after: string;
  locked_at: string | null;
  worker_id: string | null;
  last_error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
