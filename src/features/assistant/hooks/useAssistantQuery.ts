import { useMutation, useQuery } from '@tanstack/react-query'

import { assistantApi } from '../api'
import type {
  AssistantQueryRequest,
  AssistantSourceReference,
  AssistantSourceOpenRequest,
  AssistantSourcePreviewRequest,
} from '../types'

export function useAssistantQuery() {
  return useMutation({
    mutationFn: (input: AssistantQueryRequest) => assistantApi.query(input),
  })
}

export function useAssistantSourcePreview() {
  return useMutation({
    mutationFn: (input: AssistantSourcePreviewRequest) => assistantApi.previewSource(input),
  })
}

export function useAssistantSourceOpen() {
  return useMutation({
    mutationFn: (input: AssistantSourceOpenRequest) => assistantApi.openSource(input),
  })
}

export function useAssistantSourcePreviewQuery(source: AssistantSourceReference | null) {
  return useQuery({
    queryKey: source
      ? [
          'assistant',
          'source-preview',
          source.asset_id,
          source.asset_version_id,
          source.chunk_id,
          source.entry_id,
        ]
      : ['assistant', 'source-preview', 'missing-source'],
    queryFn: () => assistantApi.previewSource({
      preview: {
        source: source!,
      },
    }),
    enabled: source !== null,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
