import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, vi } from 'vitest'

import AssistantSourceRoute from '@/pages/AssistantSource'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function renderAssistantSourcePage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/browse/source" element={<AssistantSourceRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AssistantSourceRoute', () => {
  it('loads a permission-safe source detail view from assistant query params', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/source-preview')) {
        return {
          ok: true,
          json: async () => ({
            preview: {
              source: {
                asset_id: 'asset_1',
                asset_version_id: 'asset_ver_1',
                chunk_id: 'chunk_1',
                entry_id: 'entry_1',
                source_kind: 'entry',
              },
              title: 'Design Department Partners with Adobe for Creative Suite',
              excerpt: 'Parul University has partnered with Adobe to provide Creative Suite access.',
              metadata: {
                source_kind: 'entry',
                entry_id: 'entry_1',
                dept: 'Design',
                type: 'MOU / Partnership',
                tags: ['adobe', 'design'],
                entry_date: '2026-01-10',
                academic_year: '2025-26',
                author_name: 'Prof. Neha Gupta',
                created_by: 'ba-001',
                priority: 'Normal',
                student_count: 200,
                external_link: '',
                collaborating_org: 'Adobe Inc.',
              },
              open_target: {
                kind: 'internal',
                path: '/browse/source?assistantAssetId=asset_1&assistantAssetVersionId=asset_ver_1&assistantChunkId=chunk_1&assistantEntryId=entry_1&assistantSourceKind=entry',
                label: 'Open source detail',
              },
            },
          }),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantSourcePage(
      '/browse/source?assistantAssetId=asset_1&assistantAssetVersionId=asset_ver_1&assistantChunkId=chunk_1&assistantEntryId=entry_1&assistantSourceKind=entry',
    )

    expect(await screen.findByText('Design Department Partners with Adobe for Creative Suite')).toBeInTheDocument()
    expect(screen.getByText('Permission-safe source detail')).toBeInTheDocument()
    expect(screen.getByText('Parul University has partnered with Adobe to provide Creative Suite access.')).toBeInTheDocument()
    expect(screen.getByText('Adobe Inc.')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/source-preview'),
        expect.objectContaining({
          credentials: 'include',
          method: 'POST',
        }),
      )
    })
  })
})
