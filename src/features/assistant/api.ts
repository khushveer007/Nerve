import { ASSISTANT_UNAVAILABLE } from './constants'
import type { AssistantAvailability, AssistantQueryRequest, AssistantQueryResult } from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const ASSISTANT_HEALTH_PATH = (import.meta.env.VITE_ASSISTANT_HEALTH_PATH || '/assistant/health').replace(
  /^\/?/,
  '/',
)

const ASSISTANT_AVAILABILITY_PENDING: AssistantAvailability = {
  available: true,
  title: 'Assistant availability check in progress.',
  description: 'The workspace is checking whether search and answer services are connected.',
  nextStep: 'Submit a question to start a session.',
  source: 'config',
}

export function assistantEnabled() {
  return import.meta.env.VITE_ASSISTANT_ENABLED === 'true'
}

export function getInitialAssistantAvailability(): AssistantAvailability {
  return assistantEnabled() ? ASSISTANT_AVAILABILITY_PENDING : ASSISTANT_UNAVAILABLE
}

export const assistantApi = {
  async getAvailability(): Promise<AssistantAvailability> {
    if (!assistantEnabled()) {
      return ASSISTANT_UNAVAILABLE
    }

    try {
      const response = await fetch(`${API_BASE_URL}${ASSISTANT_HEALTH_PATH}`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || payload.available === false) {
        return {
          available: false,
          title: payload.title || ASSISTANT_UNAVAILABLE.title,
          description: payload.message || payload.description || ASSISTANT_UNAVAILABLE.description,
          nextStep: payload.nextStep || ASSISTANT_UNAVAILABLE.nextStep,
          source: response.ok ? 'service' : 'error',
        }
      }

      return {
        available: true,
        title: payload.title || 'Assistant is available.',
        description: payload.description || 'Search and answer services are connected.',
        nextStep: payload.nextStep || 'Submit a question to start a session.',
        source: 'service',
      }
    } catch {
      return {
        ...ASSISTANT_UNAVAILABLE,
        source: 'error',
      }
    }
  },

  async query(input: AssistantQueryRequest): Promise<AssistantQueryResult> {
    const response = await fetch(`${API_BASE_URL}/assistant/query`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(payload.message || 'Assistant request failed.')
    }

    return payload.result as AssistantQueryResult
  },
}
