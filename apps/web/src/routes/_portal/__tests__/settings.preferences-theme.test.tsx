// @vitest-environment happy-dom
/**
 * Portal settings/preferences: the theme picker shows only when the workspace
 * lets readers choose their theme (Branding theme mode 'user'). A portal
 * forced to light or dark hides it, as the header's theme toggle does.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'

const portalLoaderData = vi.hoisted(() => ({ themeMode: 'user' as 'user' | 'light' | 'dark' }))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute:
    () =>
    <T extends object>(options: T) => ({
      ...options,
      useLoaderData: () => ({ notificationPreferences: null, messages: {} }),
    }),
  useLoaderData: () => portalLoaderData,
}))
vi.mock('@/lib/server/functions/user', () => ({ getNotificationPreferencesFn: vi.fn() }))
vi.mock('@/components/theme-switcher', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher" />,
}))
vi.mock('@/components/settings/notification-matrix-form', () => ({
  NotificationMatrixForm: () => null,
}))
vi.mock('@/components/shared/area-messages', () => ({
  AreaMessages: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/public/portal-page-header', () => ({ PortalPageHeader: () => null }))

import { Route } from '../settings.preferences'

function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component
  return render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <Page />
    </IntlProvider>
  )
}

describe('settings/preferences theme picker', () => {
  it('shows the theme picker when readers may choose their theme', () => {
    portalLoaderData.themeMode = 'user'
    renderPage()

    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })

  it.each(['light', 'dark'] as const)('hides it when the portal is forced to %s', (mode) => {
    portalLoaderData.themeMode = mode
    renderPage()

    expect(screen.queryByTestId('theme-switcher')).not.toBeInTheDocument()
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument()
  })
})
