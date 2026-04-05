import { useMutation } from '@tanstack/react-query'

import { assistantApi } from '../api'
import type { AssistantQueryRequest } from '../types'

export function useAssistantQuery() {
  return useMutation({
    mutationFn: (input: AssistantQueryRequest) => assistantApi.query(input),
  })
}
