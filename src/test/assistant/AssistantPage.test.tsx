import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import AssistantStatusAnnouncer from '@/features/assistant/components/AssistantStatusAnnouncer'
import AIQueryPage from '@/pages/AIQuery'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 1024,
  })
})

function renderAssistantPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AIQueryPage />
    </QueryClientProvider>,
  )
}

function createDeferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return { promise, resolve }
}

function buildAssistantQueryResponse() {
  return {
    result: {
      mode: 'search',
      answer: null,
      enough_evidence: true,
      grounded: false,
      citations: [],
      follow_up_suggestions: [],
      applied_filters: {
        department: null,
        date_range: {
          start: null,
          end: null,
        },
        sort: 'relevance',
      },
      request_id: 'req_test_1',
      total_results: 1,
      results: [
        {
          asset_id: 'asset_1',
          asset_version_id: 'asset_ver_1',
          chunk_id: 'chunk_1',
          entry_id: 'entry_1',
          title: 'Design Department Partners with Adobe for Creative Suite',
          source_kind: 'entry',
          media_type: 'text',
          snippet: 'Parul University has partnered with Adobe to provide Creative Suite access.',
          score: 2.4,
          actions: {
            preview: {
              available: true,
            },
            open_source: {
              available: true,
            },
          },
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
          citation_locator: {
            asset_id: 'asset_1',
            asset_version_id: 'asset_ver_1',
            chunk_id: 'chunk_1',
            title: 'Design Department Partners with Adobe for Creative Suite',
            source_kind: 'entry',
            page_from: null,
            page_to: null,
            heading_path: ['Entry overview'],
            char_start: 0,
            char_end: 120,
          },
        },
      ],
    },
  }
}

function buildAutoAskQueryResponse() {
  const payload = buildGroundedAskQueryResponse()
  payload.result.mode = 'ask'
  return payload
}

function buildGroundedAskQueryResponse() {
  const payload = buildAssistantQueryResponse()
  payload.result.mode = 'ask'
  payload.result.answer = 'The Design Department partnered with Adobe to give 200 design students access to the full Creative Suite for their academic tenure. [S1]'
  payload.result.grounded = true
  payload.result.enough_evidence = true
  payload.result.citations = [
    {
      label: 'S1',
      asset_id: 'asset_1',
      title: 'Design Department Partners with Adobe for Creative Suite',
      source_kind: 'entry',
      snippet: 'Parul University has partnered with Adobe to provide Creative Suite access.',
      source: {
        asset_id: 'asset_1',
        asset_version_id: 'asset_ver_1',
        chunk_id: 'chunk_1',
        entry_id: 'entry_1',
        source_kind: 'entry',
      },
      actions: {
        preview: {
          available: true,
        },
        open_source: {
          available: true,
        },
      },
      citation_locator: {
        asset_id: 'asset_1',
        asset_version_id: 'asset_ver_1',
        chunk_id: 'chunk_1',
        title: 'Design Department Partners with Adobe for Creative Suite',
        source_kind: 'entry',
        page_from: null,
        page_to: null,
        heading_path: ['Entry overview'],
        char_start: 0,
        char_end: 120,
      },
    },
  ]
  payload.result.follow_up_suggestions = [
    'Open a supporting source below if you want to verify the cited entry evidence.',
  ]
  return payload
}

function buildLowConfidenceAskQueryResponse() {
  const payload = buildAssistantQueryResponse()
  payload.result.mode = 'ask'
  payload.result.answer = null
  payload.result.grounded = false
  payload.result.enough_evidence = false
  payload.result.follow_up_suggestions = [
    'Try asking about a single entry title or a narrower date range.',
    'Open a supporting source below to inspect the evidence that was retrieved.',
  ]
  return payload
}

function buildNoResultsQueryResponse() {
  return {
    result: {
      mode: 'search',
      answer: null,
      enough_evidence: false,
      grounded: false,
      citations: [],
      follow_up_suggestions: [
        'Try an exact entry title, department name, or date range from the existing corpus.',
        'Keep queries entry-focused in Phase 1 because uploads and mixed media arrive in later stories.',
      ],
      applied_filters: {
        department: null,
        date_range: {
          start: null,
          end: null,
        },
        sort: 'relevance',
      },
      request_id: 'req_test_empty',
      total_results: 0,
      results: [],
    },
  }
}

function buildAssistantPreviewResponse() {
  return {
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
  }
}

function buildAssistantOpenResponse() {
  return {
    open: {
      source: {
        asset_id: 'asset_1',
        asset_version_id: 'asset_ver_1',
        chunk_id: 'chunk_1',
        entry_id: 'entry_1',
        source_kind: 'entry',
      },
      target: {
        kind: 'internal',
        path: '/browse/source?assistantAssetId=asset_1&assistantAssetVersionId=asset_ver_1&assistantChunkId=chunk_1&assistantEntryId=entry_1&assistantSourceKind=entry',
        label: 'Open source detail',
      },
    },
  }
}

function buildAssistantQueryResponseWithManyResults(totalResults = 6) {
  const payload = buildAssistantQueryResponse()
  payload.result.total_results = totalResults
  payload.result.results = Array.from({ length: totalResults }, (_, index) => ({
    ...payload.result.results[0],
    asset_id: `asset_${index + 1}`,
    asset_version_id: `asset_ver_${index + 1}`,
    chunk_id: `chunk_${index + 1}`,
    entry_id: `entry_${index + 1}`,
    title: `Design Department Result ${index + 1}`,
    snippet: `Result snippet ${index + 1} for the assistant transcript.`,
    citation_locator: {
      ...payload.result.results[0].citation_locator,
      asset_id: `asset_${index + 1}`,
      asset_version_id: `asset_ver_${index + 1}`,
      chunk_id: `chunk_${index + 1}`,
      title: `Design Department Result ${index + 1}`,
    },
  }))

  return payload
}

describe('AIQueryPage', () => {
  it('renders the assistant shell, empty state, and unavailable guidance without legacy fallback copy', async () => {
    renderAssistantPage()

    expect(screen.getByRole('heading', { name: 'Assistant' })).toBeInTheDocument()
    expect(
      screen.getByText('Search and answer across Nerve knowledge with citations.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New conversation' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.getByText('Trusted answers start with verified retrieval.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /assistant starter prompt/i })).toHaveLength(5)

    expect(
      await screen.findByText(/assistant search and answer services are unavailable/i),
    ).toBeInTheDocument()

    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument()
    expect(screen.queryByText(/AI backend disconnected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/local keyword search results/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Copy last response/i })).not.toBeInTheDocument()
  })

  it('appends transcript turns, preserves the selected mode, and resets with a new conversation', () => {
    renderAssistantPage()

    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, {
      target: { value: 'How do I prepare an accreditation summary?' },
    })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(screen.getByText('How do I prepare an accreditation summary?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Trusted answers start with verified retrieval.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))

    expect(screen.queryByText('How do I prepare an accreditation summary?')).not.toBeInTheDocument()
    expect(screen.getByText('Trusted answers start with verified retrieval.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('submits on Enter and keeps multiline editing on Shift+Enter', () => {
    renderAssistantPage()

    const composer = screen.getByLabelText('Message assistant')

    fireEvent.change(composer, { target: { value: 'Line one' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter', shiftKey: true })

    expect(screen.queryByText('Current session')).not.toBeInTheDocument()
    expect(composer).toHaveValue('Line one')

    fireEvent.change(composer, { target: { value: 'Line one\nLine two' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(screen.getByText(/Line one/)).toBeInTheDocument()
  })

  it('does not show unavailable guidance while a healthy enabled backend is being checked', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        available: true,
        description: 'Search and answer services are connected.',
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    expect(
      screen.queryByText(/assistant search and answer services are unavailable/i),
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    expect(
      screen.queryByText(/assistant search and answer services are unavailable/i),
    ).not.toBeInTheDocument()
  })

  it('submits a known-item query and renders entry-backed backend results without local fallback copy', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBe(
          JSON.stringify({
            query: {
              mode: 'search',
              text: 'Adobe Creative Suite',
              filters: {
                department: null,
                date_range: {
                  start: null,
                  end: null,
                },
                sort: 'relevance',
              },
            },
          }),
        )

        return {
          ok: true,
          json: async () => buildAssistantQueryResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText('Design Department Partners with Adobe for Creative Suite')).toBeInTheDocument()
    expect(screen.getAllByText(/1 entry-backed result/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Adobe Inc.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open source' })).toBeInTheDocument()
    expect(screen.queryByText(/local keyword search results/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/AI backend disconnected/i)).not.toBeInTheDocument()
  })

  it('submits Phase 1 filters, snapshots them per turn, and reveals more than five results on demand', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const queryPayload = buildAssistantQueryResponseWithManyResults(6)
    queryPayload.result.applied_filters = {
      department: 'Design',
      date_range: {
        start: '2026-01-01',
        end: '2026-01-31',
      },
      sort: 'newest',
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        expect(init?.body).toBe(
          JSON.stringify({
            query: {
              mode: 'search',
              text: 'Adobe Creative Suite',
              filters: {
                department: 'Design',
                date_range: {
                  start: '2026-01-01',
                  end: '2026-01-31',
                },
                sort: 'newest',
              },
            },
          }),
        )

        return {
          ok: true,
          json: async () => queryPayload,
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'Design' } })
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-01-31' } })
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'newest' } })

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText('Design Department Result 1')).toBeInTheDocument()
    expect(screen.getAllByText('Department: Design').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Date: Jan 1, 2026 to Jan 31, 2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sort: Newest').length).toBeGreaterThan(0)
    expect(screen.getByText('6 entry-backed results')).toBeInTheDocument()
    expect(screen.queryByText('Design Department Result 6')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show more results' }))

    expect(await screen.findByText('Design Department Result 6')).toBeInTheDocument()
  })

  it('keeps filters across new conversations and clears them only through direct filter actions', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const queryBodies: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        queryBodies.push(String(init?.body))
        return {
          ok: true,
          json: async () => buildAssistantQueryResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'Design' } })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText('Department: Design')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))

    expect(screen.getByLabelText('Department')).toHaveValue('Design')
    expect(screen.getByText('Department: Design')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))

    expect(screen.getByLabelText('Department')).toHaveValue('')
    expect(screen.queryByText('Department: Design')).not.toBeInTheDocument()

    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(queryBodies).toHaveLength(2)
    })

    expect(queryBodies[1]).toBe(
      JSON.stringify({
        query: {
          mode: 'auto',
          text: 'Adobe Creative Suite',
          filters: {
            department: null,
            date_range: {
              start: null,
              end: null,
            },
            sort: 'relevance',
          },
        },
      }),
    )
  })

  it('loads a permission-safe preview into the evidence panel and omits blocked actions from result cards', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const queryPayload = buildAssistantQueryResponse()
    queryPayload.result.results[0].actions = {
      preview: { available: true },
      open_source: { available: false },
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => queryPayload,
        }
      }

      if (url.endsWith('/assistant/source-preview')) {
        return {
          ok: true,
          json: async () => buildAssistantPreviewResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText('Design Department Partners with Adobe for Creative Suite')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open source' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect((await screen.findAllByText('Entry preview')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Open source' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Adobe Inc.').length).toBeGreaterThan(0)
  })

  it('renders grounded ask answers with inline citation chips and supporting evidence', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildGroundedAskQueryResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Explain the Adobe partnership.' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText(/grounded answer/i)).toBeInTheDocument()
    expect(screen.getByText(/give 200 design students access to the full creative suite/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Inspect citation S1 for Design Department Partners with Adobe for Creative Suite at Entry overview',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Inspect citation S1 for Design Department Partners with Adobe for Creative Suite at Entry overview',
      }).closest('p'),
    ).not.toBeNull()
    expect(
      screen.getByRole('button', {
        name: 'Inspect citation S1 for Design Department Partners with Adobe for Creative Suite at Entry overview',
      }),
    ).toHaveClass('min-w-11')
    expect(screen.getByText('Supporting sources')).toBeInTheDocument()
    expect(screen.getByText('Design Department Partners with Adobe for Creative Suite')).toBeInTheDocument()
  })

  it('opens citation evidence from citation focus and preserves the selected citation through preview actions', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildGroundedAskQueryResponse(),
        }
      }

      if (url.endsWith('/assistant/source-preview')) {
        return {
          ok: true,
          json: async () => buildAssistantPreviewResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Explain the Adobe partnership.' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    const citationButton = await screen.findByRole('button', {
      name: 'Inspect citation S1 for Design Department Partners with Adobe for Creative Suite at Entry overview',
    })

    fireEvent.focus(citationButton)

    expect((await screen.findAllByText('Selected citation')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('S1').length).toBeGreaterThan(0)
    expect(screen.getByText('Locator')).toBeInTheDocument()
    expect(screen.getByText('Entry overview')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Preview' }).length).toBeGreaterThan(1)

    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' }).at(-1)!)

    expect(await screen.findByText('Entry preview')).toBeInTheDocument()
    expect(screen.getAllByText('Selected citation').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Design Department Partners with Adobe for Creative Suite').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))

    expect(screen.queryByText('Selected citation')).not.toBeInTheDocument()
    expect(screen.queryByText('Entry preview')).not.toBeInTheDocument()
  })

  it('surfaces safe error copy when a source preview is denied', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildAssistantQueryResponse(),
        }
      }

      if (url.endsWith('/assistant/source-preview')) {
        return {
          ok: false,
          json: async () => ({
            message: 'You are not authorized to access that source.',
          }),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByRole('button', { name: 'Preview' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect((await screen.findAllByText('Source preview unavailable.')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('You are not authorized to access that source.').length).toBeGreaterThan(0)
    expect(screen.queryByText(/hidden-source teaser/i)).not.toBeInTheDocument()
  })

  it('requests assistant-scoped source detail targets for open-source actions', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')
    const consoleError = vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
      if (String(message).includes('Not implemented: navigation')) {
        return
      }
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildAssistantQueryResponse(),
        }
      }

      if (url.endsWith('/assistant/source-open')) {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBe(
          JSON.stringify({
            open: {
              source: {
                asset_id: 'asset_1',
                asset_version_id: 'asset_ver_1',
                chunk_id: 'chunk_1',
                entry_id: 'entry_1',
                source_kind: 'entry',
              },
            },
          }),
        )

        return {
          ok: true,
          json: async () => buildAssistantOpenResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByRole('button', { name: 'Open source' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open source' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/source-open'),
        expect.objectContaining({
          credentials: 'include',
          method: 'POST',
        }),
      )
    })

    consoleError.mockRestore()
  })

  it('ignores stale preview responses after starting a new conversation', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const previewResponse = createDeferred<{
      ok: boolean
      json: () => Promise<ReturnType<typeof buildAssistantPreviewResponse>>
    }>()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildAssistantQueryResponse(),
        }
      }

      if (url.endsWith('/assistant/source-preview')) {
        return previewResponse.promise
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByRole('button', { name: 'Preview' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))

    await act(async () => {
      previewResponse.resolve({
        ok: true,
        json: async () => buildAssistantPreviewResponse(),
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.queryByText('Entry preview')).not.toBeInTheDocument()
    })

    expect(screen.queryByText('Entry preview')).not.toBeInTheDocument()
    expect(screen.getByText('Trusted answers start with verified retrieval.')).toBeInTheDocument()
  })

  it('ignores stale assistant replies after starting a new conversation', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const deferredQuery = createDeferred<ReturnType<typeof buildAssistantQueryResponse>>()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            title: 'Assistant is available.',
            description: 'Entry-backed assistant services are connected.',
            nextStep: 'Submit a question to start a session.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => deferredQuery.promise,
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText('Adobe Creative Suite')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Message assistant')).not.toBeDisabled()
    })

    await act(async () => {
      deferredQuery.resolve(buildAssistantQueryResponse())
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.queryByText('Adobe Creative Suite')).not.toBeInTheDocument()
      expect(screen.queryByText('Design Department Partners with Adobe for Creative Suite')).not.toBeInTheDocument()
    })
  })

  it('blocks assistant submission until the initial availability check settles', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const deferredHealth = createDeferred<{
      available: boolean
      title: string
      description: string
      nextStep: string
    }>()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => deferredHealth.promise,
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Checking assistant availability.')
    })
    expect(screen.getByLabelText('Message assistant')).toBeDisabled()

    fireEvent.click(screen.getAllByRole('button', { name: /assistant starter prompt/i })[0])

    expect(screen.queryByText('Current session')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      deferredHealth.resolve({
        available: true,
        title: 'Assistant is available.',
        description: 'Entry-backed assistant services are connected.',
        nextStep: 'Submit a question to start a session.',
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Message assistant')).not.toBeDisabled()
    })
  })

  it('surfaces healthy assistant status while the entry corpus is still preparing', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        available: true,
        title: 'Assistant is preparing the entry corpus.',
        description: 'The backend is healthy, but the entry corpus has not been indexed yet.',
        nextStep: 'Start the worker or wait for queued jobs to finish before validating search results.',
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    expect(await screen.findByText('Assistant is preparing the entry corpus.')).toBeInTheDocument()
    expect(screen.getByText(/entry corpus has not been indexed yet/i)).toBeInTheDocument()
    expect(screen.getByText(/start the worker or wait for queued jobs to finish/i)).toBeInTheDocument()
    expect(screen.queryByText(/assistant search and answer services are unavailable/i)).not.toBeInTheDocument()
  })

  it('makes routed auto-to-ask grounded answers explicit', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildAutoAskQueryResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Summarize the Adobe partnership' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText(/auto mode routed this turn through ask/i)).toBeInTheDocument()
    expect(screen.getByText(/grounded answer/i)).toBeInTheDocument()
    expect(screen.getByText(/full creative suite/i)).toBeInTheDocument()
  })

  it('keeps auto-mode loading copy neutral until routing resolves', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const deferredQuery = createDeferred<ReturnType<typeof buildAssistantQueryResponse>>()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => deferredQuery.promise,
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Adobe Creative Suite' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Retrieving matching entries.')
    })
    expect(screen.getByText('Routing the question and gathering evidence.')).toBeInTheDocument()
    expect(screen.queryByText('Generating a grounded answer.')).not.toBeInTheDocument()

    await act(async () => {
      deferredQuery.resolve(buildAssistantQueryResponse())
      await Promise.resolve()
    })

    expect(await screen.findByText(/design department partners with adobe/i)).toBeInTheDocument()
  })

  it('shows neutral no-results guidance with one-click retry and edit actions', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildNoResultsQueryResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'starlight orchard memo' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect((await screen.findAllByText(/no accessible entry-backed matches/i)).length).toBeGreaterThan(0)
    expect(screen.getByText(/exact entry title, department name, or date range/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit original query' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit original query' }))
    expect(screen.getByLabelText('Message assistant')).toHaveValue('starlight orchard memo')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })

  it('distinguishes low-confidence ask results from zero-result no-answer states', async () => {
    vi.stubEnv('VITE_ASSISTANT_ENABLED', 'true')

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.endsWith('/assistant/health')) {
        return {
          ok: true,
          json: async () => ({
            available: true,
            description: 'Entry-backed assistant services are connected.',
          }),
        }
      }

      if (url.endsWith('/assistant/query')) {
        return {
          ok: true,
          json: async () => buildLowConfidenceAskQueryResponse(),
        }
      }

      throw new Error(`Unexpected fetch call for ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    renderAssistantPage()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assistant/health'),
        expect.objectContaining({
          credentials: 'include',
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    const composer = screen.getByLabelText('Message assistant')
    fireEvent.change(composer, { target: { value: 'Explain the Adobe partnership in detail.' } })
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' })

    expect(await screen.findByText(/not enough consistent evidence/i)).toBeInTheDocument()
    expect(screen.getByText(/sources available to you/i)).toBeInTheDocument()
    expect(screen.getByText('Supporting sources')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument()
  })
})

describe('AssistantStatusAnnouncer', () => {
  it('announces visible status changes through a pre-mounted live region', async () => {
    const { rerender } = render(<AssistantStatusAnnouncer message="" />)

    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()

    rerender(<AssistantStatusAnnouncer message="Retrieving matching entries." />)
    await waitFor(() => {
      expect(region).toHaveTextContent('Retrieving matching entries.')
    })

    rerender(<AssistantStatusAnnouncer message="Generating grounded answer." />)
    await waitFor(() => {
      expect(region).toHaveTextContent('Generating grounded answer.')
    })
  })
})
