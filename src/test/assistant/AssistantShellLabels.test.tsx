import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, vi } from 'vitest'

import AppSidebar from '@/components/AppSidebar'
import ContentAdminDashboard from '@/pages/content/ContentAdminDashboard'
import ContentSubAdminDashboard from '@/pages/content/ContentSubAdminDashboard'
import ContentUserDashboard from '@/pages/content/ContentUserDashboard'

const mockUseAuth = vi.fn()
const mockUseAppData = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  getRoleDashboard: vi.fn(() => '/content/user'),
}))

vi.mock('@/hooks/useAppData', () => ({
  useAppData: () => mockUseAppData(),
}))

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    profile: { full_name: 'Jordan Rivera' },
    role: 'user',
    team: 'content',
    loading: false,
    signOut: vi.fn(),
  })

  mockUseAppData.mockReturnValue({
    entries: [],
    users: [],
    addUser: vi.fn(),
  })
})

describe('assistant shell naming', () => {
  it('keeps the sidebar link on /ai/query while showing Assistant to the user', () => {
    render(
      <MemoryRouter initialEntries={['/ai/query']}>
        <AppSidebar />
      </MemoryRouter>,
    )

    const assistantLink = screen.getByRole('link', { name: 'Assistant' })
    expect(assistantLink).toHaveAttribute('href', '/ai/query')
    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument()
  })

  it('renames the content dashboard shortcuts to Assistant', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ContentAdminDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Assistant/i })).toHaveAttribute('href', '/ai/query')
    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <ContentSubAdminDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Assistant/i })).toHaveAttribute('href', '/ai/query')
    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <ContentUserDashboard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Assistant/i })).toHaveAttribute('href', '/ai/query')
    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument()
  })
})
