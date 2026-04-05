import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import AssistantStatusAnnouncer from '@/features/assistant/components/AssistantStatusAnnouncer'
import AIQueryPage from '@/pages/AIQuery'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
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
