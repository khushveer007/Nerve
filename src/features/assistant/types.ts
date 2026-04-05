export type AssistantMode = 'auto' | 'search' | 'ask'
export type AssistantRole = 'user' | 'assistant'
export type AssistantStatus = 'empty' | 'loading' | 'result' | 'no_answer' | 'error' | 'unavailable'
export type AssistantLoadingStage = 'retrieving' | 'generating'

export interface AssistantMessage {
  id: string
  role: AssistantRole
  content: string
  mode: AssistantMode
  createdAt: string
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
  | { kind: 'loading'; stage: AssistantLoadingStage }
  | { kind: 'result' }
  | { kind: 'no_answer'; title: string; description: string }
  | { kind: 'error'; title: string; description: string }
  | {
      kind: 'unavailable'
      title: string
      description: string
      nextStep: string
    }
