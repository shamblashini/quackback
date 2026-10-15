// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    search,
    children,
    className,
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
    className?: string
  }) => (
    <a href={`${to}?${new URLSearchParams(search ?? {}).toString()}`} className={className}>
      {children}
    </a>
  ),
}))

import { ReportNotice } from '../reports/report-notice'
import { ReportTypePicker, PrivateReportBadge } from '../reports/report-type-picker'
import {
  ReportGuide,
  reportGuideNeedsAcknowledgement,
  type ReportGuideConfig,
} from '../reports/report-guide'

const wrap = (ui: ReactNode) =>
  render(
    <IntlProvider locale="en" defaultLocale="en" onError={() => {}}>
      {ui}
    </IntlProvider>
  )

afterEach(() => cleanup())

describe('<ReportNotice>', () => {
  it('renders nothing for a blank notice', () => {
    const { container } = wrap(<ReportNotice markdown="   " />)
    expect(container).toBeEmptyDOMElement()
    cleanup()
    const undef = wrap(<ReportNotice markdown={undefined} />)
    expect(undef.container).toBeEmptyDOMElement()
  })

  it('renders Markdown in the destructive colour', () => {
    wrap(<ReportNotice markdown={'**False reports are punished.**'} />)
    const notice = screen.getByTestId('report-notice')
    expect(notice.className).toContain('text-destructive')
    expect(screen.getByText('False reports are punished.').tagName).toBe('STRONG')
  })

  it('never renders raw HTML', () => {
    wrap(<ReportNotice markdown={'<img src=x onerror=alert(1)> hi'} />)
    expect(screen.getByTestId('report-notice').querySelector('img')).toBeNull()
  })
})

describe('<ReportTypePicker>', () => {
  const types = [
    {
      id: 'b1',
      name: 'Player complaints',
      slug: 'players',
      description: 'About players',
      isPrivate: false,
    },
    { id: 'b2', name: 'Admin appeals', slug: 'appeals', description: null, isPrivate: true },
  ]

  it('shows one card per type linking to ?type=<slug>', () => {
    wrap(<ReportTypePicker types={types} />)
    expect(screen.getByRole('link', { name: /Player complaints/ })).toHaveAttribute(
      'href',
      '/reports?type=players'
    )
    expect(screen.getByRole('link', { name: /Admin appeals/ })).toHaveAttribute(
      'href',
      '/reports?type=appeals'
    )
    expect(screen.getByText('About players')).toBeInTheDocument()
  })

  it('marks only the private type with the private line', () => {
    wrap(<ReportTypePicker types={types} />)
    expect(screen.getAllByText('Private: only you and the team can see it')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Admin appeals/ }).textContent).toContain(
      'Private: only you and the team can see it'
    )
  })

  it('keeps the list filters on the card links', () => {
    wrap(<ReportTypePicker types={types} status="open" boardFilter="players" />)
    expect(screen.getByRole('link', { name: /Player complaints/ })).toHaveAttribute(
      'href',
      '/reports?type=players&status=open&board=players'
    )
  })

  it('renders nothing without types', () => {
    const { container } = wrap(<ReportTypePicker types={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('has a standalone private badge', () => {
    wrap(<PrivateReportBadge />)
    expect(screen.getByTestId('private-report-badge')).toHaveTextContent('Private')
  })
})

describe('<ReportGuide>', () => {
  const guide = (over: Partial<ReportGuideConfig> = {}): ReportGuideConfig => ({
    boardId: 'b1',
    boardName: 'Player complaints',
    isPrivate: false,
    notice: 'Do not lie.',
    rules: 'Be kind.',
    canChangeType: true,
    changeTypeSearch: {},
    ...over,
  })

  it('shows the notice first, then the rules open by default, then the confirmation', () => {
    wrap(<ReportGuide guide={guide()} accepted={false} onAcceptedChange={() => {}} />)
    const root = screen.getByTestId('report-guide')
    const order = ['report-notice', 'report-rules-collapsible'].map((id) =>
      root.innerHTML.indexOf(`data-testid="${id}"`)
    )
    expect(order[0]).toBeGreaterThan(-1)
    expect(order[0]).toBeLessThan(order[1])
    expect(screen.getByText('Be kind.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rules/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('I confirm that I have read the submission rules')).toBeInTheDocument()
  })

  it('reports the confirmation through onAcceptedChange', () => {
    const onChange = vi.fn()
    wrap(<ReportGuide guide={guide()} accepted={false} onAcceptedChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('has no checkbox and no rules card when the type has no rules', () => {
    wrap(
      <ReportGuide guide={guide({ rules: '  ' })} accepted={false} onAcceptedChange={() => {}} />
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByTestId('report-rules-collapsible')).toBeNull()
  })

  it('says a private type is private, and offers Change type', () => {
    wrap(
      <ReportGuide
        guide={guide({ isPrivate: true, changeTypeSearch: { status: 'open' } })}
        accepted={false}
        onAcceptedChange={() => {}}
      />
    )
    expect(screen.getByText(/This type is private/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Change type/ })).toHaveAttribute(
      'href',
      '/reports?status=open'
    )
  })

  it('hides Change type when there is only one type to pick', () => {
    wrap(
      <ReportGuide
        guide={guide({ canChangeType: false })}
        accepted={false}
        onAcceptedChange={() => {}}
      />
    )
    expect(screen.queryByRole('link', { name: /Change type/ })).toBeNull()
  })

  it('needs an acknowledgement only when the type has rules', () => {
    expect(reportGuideNeedsAcknowledgement(undefined)).toBe(false)
    expect(reportGuideNeedsAcknowledgement(guide({ rules: '' }))).toBe(false)
    expect(reportGuideNeedsAcknowledgement(guide())).toBe(true)
  })
})
