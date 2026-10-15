// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { CustomFieldAnswers } from '../custom-field-answers'
import type { BoardCustomField } from '@/lib/shared/db-types'

const FIELDS: BoardCustomField[] = [
  { key: 'video', label: 'Video', type: 'url', required: true },
  { key: 'ids', label: 'Game IDs', type: 'id_list', required: true },
  { key: 'when', label: 'When', type: 'datetime', required: false },
  { key: 'agreed', label: 'Agreed', type: 'checkbox', required: false },
  { key: 'skipped', label: 'Skipped', type: 'text', required: false },
]

function show(values: Record<string, unknown> | null, fields: BoardCustomField[] = FIELDS) {
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <CustomFieldAnswers fields={fields} values={values} />
    </IntlProvider>
  )
}

describe('<CustomFieldAnswers>', () => {
  it('renders labelled answers in the board field order, skipping unanswered fields', () => {
    const { container } = show({
      ids: '#1, #12',
      video: 'https://youtu.be/abc',
      agreed: false,
    })
    const labels = Array.from(container.querySelectorAll('dt')).map((n) => n.textContent)
    expect(labels).toEqual(['Video', 'Game IDs', 'Agreed'])
    expect(screen.getByText('#1, #12')).toBeTruthy()
  })

  it('links urls safely', () => {
    show({ video: 'https://youtu.be/abc' })
    const link = screen.getByRole('link', { name: 'https://youtu.be/abc' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow')
  })

  it('does not link a non-http url value', () => {
    show({ video: 'javascript:alert(1)' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeTruthy()
  })

  it('formats datetimes in the viewer locale', () => {
    show({ when: '2026-05-01T10:30:00.000Z' })
    const expected = new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date('2026-05-01T10:30:00.000Z'))
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('shows checkboxes as check / cross marks', () => {
    show({ agreed: true })
    expect(screen.getByText('✓')).toBeTruthy()
    show({ agreed: false })
    expect(screen.getByText('✗')).toBeTruthy()
  })

  it('renders nothing without answers or definitions', () => {
    expect(show(null).container.firstChild).toBeNull()
    expect(show({}).container.firstChild).toBeNull()
    expect(show({ video: 'https://a.b' }, []).container.firstChild).toBeNull()
  })
})
