// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlProvider } from 'react-intl'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

import { DiscordAccountChip } from '../discord-account-chip'

const renderChip = (id: string | null | undefined) =>
  render(
    <IntlProvider locale="en" defaultLocale="en" onError={() => {}}>
      <DiscordAccountChip discordId={id} />
    </IntlProvider>
  )

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  toast.success.mockClear()
  toast.error.mockClear()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(cleanup)

describe('DiscordAccountChip', () => {
  it('renders nothing without an id', () => {
    const { container } = renderChip(null)
    expect(container.innerHTML).toBe('')
  })

  it('shows the id and links to the Discord profile safely', () => {
    renderChip('123456789012345678')
    expect(screen.getByTestId('discord-id').textContent).toBe('123456789012345678')
    const link = screen.getByRole('link', { name: 'Open in Discord' })
    expect(link.getAttribute('href')).toBe('https://discord.com/users/123456789012345678')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('copies the id and confirms with a toast', async () => {
    writeText.mockResolvedValue(undefined)
    renderChip('42')
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Copied'))
    expect(writeText).toHaveBeenCalledWith('42')
  })

  it('reports a rejected clipboard write without throwing', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderChip('42')
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
