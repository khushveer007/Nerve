export type AssistantMode = 'auto' | 'search' | 'ask'
export type AssistantRole = 'user' | 'assistant'
export type AssistantStatus = 'empty' | 'loading' | 'info' | 'result' | 'no_answer' | 'error' | 'unavailable'
export type AssistantLoadingStage = 'checking' | 'retrieving' | 'generating'

export interface AssistantQueryFilters {
  departments: string[]
  entry_types: string[]
  priorities: string[]
  tags: string[]
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
  results: AssistantEntryResult[]
  follow_up_suggestions: string[]
  request_id: string
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
