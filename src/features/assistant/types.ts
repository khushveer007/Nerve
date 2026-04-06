export type AssistantMode = 'auto' | 'search' | 'ask'
export type AssistantRole = 'user' | 'assistant'
export type AssistantStatus = 'empty' | 'loading' | 'info' | 'result' | 'no_answer' | 'error' | 'unavailable'
export type AssistantLoadingStage = 'checking' | 'retrieving' | 'generating'
export type AssistantSort = 'relevance' | 'newest'

export interface AssistantDateRangeFilter {
  start: string | null
  end: string | null
}

export interface AssistantQueryFilters {
  department: string | null
  date_range: AssistantDateRangeFilter
  sort: AssistantSort
}

export interface AssistantCitationLocator {
  asset_id: string
  asset_version_id: string
  chunk_id: string
  title: string
  source_kind: 'entry'
  page_from: number | null
  page_to: number | null
  heading_path: string[]
  char_start: number
  char_end: number
}

export interface AssistantSourceReference {
  asset_id: string
  asset_version_id: string
  chunk_id: string
  entry_id: string
  source_kind: 'entry'
}

export interface AssistantResultActionAvailability {
  available: boolean
}

export interface AssistantResultActions {
  preview: AssistantResultActionAvailability
  open_source: AssistantResultActionAvailability
}

export interface AssistantSourceOpenTarget {
  kind: 'internal'
  path: string
  label: string
}

export interface AssistantEntryMetadata {
  source_kind: 'entry'
  entry_id: string
  dept: string
  type: string
  tags: string[]
  entry_date: string
  academic_year: string
  author_name: string
  created_by: string | null
  priority: string
  student_count: number | null
  external_link: string
  collaborating_org: string
}

export interface AssistantEntryResult {
  asset_id: string
  asset_version_id: string
  chunk_id: string
  entry_id: string
  title: string
  source_kind: 'entry'
  media_type: 'text'
  snippet: string
  score: number
  metadata: AssistantEntryMetadata
  citation_locator: AssistantCitationLocator
  actions: AssistantResultActions
}

export interface AssistantCitation {
  label: string
  asset_id: string
  title: string
  source_kind: 'entry'
  snippet: string
  citation_locator: AssistantCitationLocator
}

export interface AssistantQueryResult {
  mode: 'search' | 'ask'
  answer: string | null
  enough_evidence: boolean
  grounded: boolean
  citations: AssistantCitation[]
  applied_filters: AssistantQueryFilters
  total_results: number
  results: AssistantEntryResult[]
  follow_up_suggestions: string[]
  request_id: string
}

export interface AssistantSourcePreviewRequest {
  preview: {
    source: AssistantSourceReference
  }
}

export interface AssistantSourcePreviewPayload {
  source: AssistantSourceReference
  title: string
  excerpt: string
  metadata: AssistantEntryMetadata
  open_target: AssistantSourceOpenTarget
}

export interface AssistantSourcePreviewResult {
  preview: AssistantSourcePreviewPayload
}

export interface AssistantSourceOpenRequest {
  open: {
    source: AssistantSourceReference
  }
}

export interface AssistantSourceOpenResult {
  open: {
    source: AssistantSourceReference
    target: AssistantSourceOpenTarget
  }
}

export interface AssistantQueryRequest {
  query: {
    mode: AssistantMode
    text: string
    filters: AssistantQueryFilters
  }
}

export interface AssistantMessage {
  id: string
  role: AssistantRole
  content: string
  mode: AssistantMode
  createdAt: string
  result?: AssistantQueryResult
  error?: {
    title: string
    description: string
  }
}

export interface AssistantAvailability {
  available: boolean
  title: string
  description: string
  nextStep: string
  source: 'config' | 'service' | 'error'
}

export type AssistantVisibleState =
  | { kind: 'empty' }
  | { kind: 'loading'; stage: AssistantLoadingStage; title: string; description: string }
  | { kind: 'info'; title: string; description: string; nextStep: string }
  | { kind: 'result' }
  | { kind: 'no_answer'; title: string; description: string }
  | { kind: 'error'; title: string; description: string }
  | {
      kind: 'unavailable'
      title: string
      description: string
      nextStep: string
    }
