import type { AssistantAvailability, AssistantMode, AssistantVisibleState } from './types'

export const ASSISTANT_MODE_OPTIONS: Array<{
  value: AssistantMode
  label: string
  description: string
}> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Let Nerve choose the right search or answer flow for the question.',
  },
  {
    value: 'search',
    label: 'Search',
    description: 'Focus on retrieving source material before answer generation is added.',
  },
  {
    value: 'ask',
    label: 'Ask',
    description: 'Use the answer-first path once grounded responses are connected.',
  },
]

export const ASSISTANT_STARTER_PROMPTS = [
  {
    id: 'accreditation-highlights',
    label: 'Accreditation-ready highlights',
    prompt: 'Summarize the strongest accreditation-ready highlights from recent Nerve updates.',
  },
  {
    id: 'placements',
    label: 'Placement wins',
    prompt: 'Find the most recent placement and industry-connection wins across departments.',
  },
  {
    id: 'research-comparison',
    label: 'Research comparison',
    prompt: 'Compare the most recent research and faculty achievements across departments.',
  },
  {
    id: 'program-updates',
    label: 'Program changes',
    prompt: 'What changed recently in academic programs, outreach, or student initiatives?',
  },
  {
    id: 'leadership-brief',
    label: 'Leadership brief',
    prompt: 'Prepare a concise leadership brief from the latest institutional updates.',
  },
] as const

export const ASSISTANT_UNAVAILABLE: AssistantAvailability = {
  available: false,
  title: 'Assistant search and answer services are unavailable.',
  description:
    'This workspace is ready, but the connected retrieval and answer service is not available in this environment yet.',
  nextStep:
    'You can still draft a question, switch modes, and reset the current session while the backend is being connected.',
  source: 'config',
}

export function getAssistantAnnouncement(state: AssistantVisibleState): string {
  switch (state.kind) {
    case 'loading':
      return state.stage === 'retrieving'
        ? 'Retrieving matching entries.'
        : 'Generating grounded answer.'
    case 'no_answer':
      return 'No grounded answer was found for the current request.'
    case 'error':
      return 'Assistant status changed. An error interrupted the current request.'
    case 'unavailable':
      return 'Assistant status changed. Search and answer services are unavailable.'
    default:
      return ''
  }
}
