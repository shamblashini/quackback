// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { IntlProvider } from 'react-intl'

const { mockPathname, mockGetRouteContext } = vi.hoisted(() => ({
  mockPathname: { value: '/' },
  mockGetRouteContext: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    invalidate: vi.fn(),
    navigate: vi.fn(),
    state: { location: { pathname: mockPathname.value } },
  }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: mockPathname.value } }),
  useRouteContext: (opts?: { select?: (context: unknown) => unknown }) =>
    opts?.select ? opts.select(mockGetRouteContext()) : mockGetRouteContext(),
  Link: ({
    to,
    children,
    className,
    ...rest
  }: {
    to: string
    children: React.ReactNode
    className?: string
    [key: string]: unknown
  }) => (
    <a href={to} className={className} {...(rest as React.HTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}))

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: vi.fn() }),
}))

vi.mock('@/components/auth/auth-popover-context', () => ({
  useAuthPopoverSafe: () => null,
}))

vi.mock('@/components/auth/oauth-buttons', () => ({
  hasAnyPortalAuthMethod: () => false,
  resolveSoleOidcProvider: () => null,
  hasDistinctSignup: () => true,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), removeQueries: vi.fn() }),
}))

vi.mock('@/lib/server/functions/conversation', () => ({
  getMyConversationsFn: vi.fn(),
}))

vi.mock('@/lib/client/hooks/use-auth-broadcast', () => ({
  useAuthBroadcast: () => {},
}))

vi.mock('@/lib/client/auth-client', () => ({
  signOut: vi.fn(),
  authClient: { signIn: { social: vi.fn() } },
}))

vi.mock('@/components/notifications', () => ({
  NotificationBell: () => null,
}))

vi.mock('@/components/shared/user-stats', () => ({
  UserStatsBar: () => null,
}))

import { PortalHeader } from '../portal-header'

function renderHeader(opts: { hasReportBoards?: boolean; variant?: 'default' | 'reports' } = {}) {
  mockPathname.value = '/'
  mockGetRouteContext.mockReturnValue({
    session: null,
    settings: { featureFlags: { feedback: true, changelog: true } },
    registeredAuthProviders: [],
  })
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <PortalHeader
        orgName="Acme"
        userRole={null}
        showThemeToggle={false}
        hasReportBoards={opts.hasReportBoards}
        variant={opts.variant}
      />
    </IntlProvider>
  )
}

describe('PortalHeader — Reports button', () => {
  afterEach(() => cleanup())

  it('shows a red Reports button to everyone when a report board is visible', () => {
    renderHeader({ hasReportBoards: true })
    const button = screen.getByTestId('portal-reports-button')
    expect(button).toHaveAttribute('href', '/reports')
    expect(button).toHaveTextContent('Reports')
    expect(button.className).toContain('bg-destructive')
  })

  it('is not part of the tab row', () => {
    renderHeader({ hasReportBoards: true })
    const nav = screen.getByRole('navigation')
    expect(nav.querySelector('a[href="/reports"]')).toBeNull()
    expect(nav.querySelector('a[href="/roadmap"]')).not.toBeNull()
  })

  it('is absent without report boards', () => {
    renderHeader({ hasReportBoards: false })
    expect(screen.queryByTestId('portal-reports-button')).toBeNull()
  })
})

describe('PortalHeader — reports mode', () => {
  afterEach(() => cleanup())

  it('swaps the tabs for a back-to-portal link and a red accent', () => {
    const { container } = renderHeader({ hasReportBoards: true, variant: 'reports' })
    expect(screen.getByRole('link', { name: 'Back to portal' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'Roadmap' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Changelog' })).toBeNull()
    expect(screen.queryByTestId('portal-reports-button')).toBeNull()
    expect(container.querySelector('.portal-header')?.className).toContain('border-t-destructive')
  })

  it('keeps the normal tabs in the default variant', () => {
    renderHeader({ hasReportBoards: true })
    expect(screen.getByRole('link', { name: 'Roadmap' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Back to portal' })).toBeNull()
  })
})
