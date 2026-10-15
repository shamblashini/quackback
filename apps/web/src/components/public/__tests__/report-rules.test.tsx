// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import {
  ReportRulesCard,
  ReportRulesCollapsible,
  collectReportRules,
} from '../reports/report-rules'

const wrap = (ui: React.ReactNode) =>
  render(
    <IntlProvider locale="en" defaultLocale="en">
      {ui}
    </IntlProvider>
  )

afterEach(() => cleanup())

describe('collectReportRules', () => {
  it('keeps only boards with non-blank rules, trimmed', () => {
    const sections = collectReportRules([
      { id: 'b1', name: 'Players', settings: { rulesMarkdown: '  Be kind  ' } },
      { id: 'b2', name: 'Bugs', settings: { rulesMarkdown: '   ' } },
      { id: 'b3', name: 'Staff', settings: {} },
      { id: 'b4', name: 'None', settings: null },
    ])
    expect(sections).toEqual([{ id: 'b1', name: 'Players', markdown: 'Be kind' }])
  })
})

describe('<ReportRulesCard>', () => {
  it('renders nothing without rules', () => {
    const { container } = wrap(<ReportRulesCard sections={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders Markdown and titles the card Rules', () => {
    wrap(
      <ReportRulesCard
        sections={[{ id: 'b1', name: 'Players', markdown: '**No spam**\n\n- rule one' }]}
      />
    )
    expect(screen.getByRole('heading', { name: 'Rules' })).toBeInTheDocument()
    expect(screen.getByText('No spam').tagName).toBe('STRONG')
    expect(screen.getByText('rule one').tagName).toBe('LI')
    // A single board needs no board-name label.
    expect(screen.queryByText('Players')).toBeNull()
  })

  it('labels each set of rules with its board when there are several', () => {
    wrap(
      <ReportRulesCard
        sections={[
          { id: 'b1', name: 'Players', markdown: 'one' },
          { id: 'b2', name: 'Bugs', markdown: 'two' },
        ]}
      />
    )
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('Bugs')).toBeInTheDocument()
  })

  it('never injects raw HTML or script URLs', () => {
    const { container } = wrap(
      <ReportRulesCard
        sections={[
          {
            id: 'b1',
            name: 'x',
            markdown:
              '<script>window.__pwned = 1</script><img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1))',
          },
        ]}
      />
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toContain('javascript:')
  })
})

describe('<ReportRulesCollapsible>', () => {
  const sections = [{ id: 'b1', name: 'Players', markdown: 'Be kind' }]

  it('starts closed and opens on click', () => {
    wrap(<ReportRulesCollapsible sections={sections} />)
    expect(screen.queryByText('Be kind')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rules' }))
    expect(screen.getByText('Be kind')).toBeInTheDocument()
  })

  it('renders nothing without rules', () => {
    const { container } = wrap(<ReportRulesCollapsible sections={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
