// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { BoardCustomFields, type BoardCustomFieldsProps } from '../board-custom-fields'
import type { BoardCustomField } from '@/lib/shared/db-types'

const FIELDS: BoardCustomField[] = [
  { key: 'use_case', label: 'Use case', type: 'text', required: true },
  { key: 'details', label: 'Details', type: 'long_text', required: false },
  { key: 'seats', label: 'Seats', type: 'number', required: false },
  { key: 'impact', label: 'Impact', type: 'select', required: true, options: ['low', 'high'] },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    required: false,
    options: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
  },
  { key: 'needed_by', label: 'Needed by', type: 'date', required: false },
  { key: 'read_docs', label: 'I read the docs', type: 'checkbox', required: true },
]

function renderWith(props: BoardCustomFieldsProps) {
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <BoardCustomFields {...props} />
    </IntlProvider>
  )
}

function renderFields(values: Record<string, unknown> = {}, onChange = vi.fn()) {
  renderWith({ fields: FIELDS, values, onChange })
  return onChange
}

describe('<BoardCustomFields>', () => {
  it('renders each field in its declared input type', () => {
    renderFields()
    expect(screen.getByLabelText(/Use case/)).toHaveProperty('type', 'text')
    expect(screen.getByLabelText(/Details/).tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText(/Seats/)).toHaveProperty('type', 'number')
    expect(screen.getByLabelText(/Needed by/)).toHaveProperty('type', 'date')
    expect(screen.getByRole('radio', { name: 'low' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'high' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /Priority/ })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: /I read the docs/ })).toBeTruthy()
  })

  it('marks required fields', () => {
    renderFields()
    expect(screen.getByText('Use case').parentElement?.textContent).toContain('*')
    expect(screen.getByText('Seats').parentElement?.textContent).not.toContain('*')
  })

  it('renders nothing when the board configures no fields', () => {
    const { container } = renderWith({ fields: [], values: {}, onChange: vi.fn() })
    expect(container.firstChild).toBeNull()
  })

  it('reports text edits by field key', () => {
    const onChange = renderFields()
    fireEvent.change(screen.getByLabelText(/Use case/), { target: { value: 'Billing' } })
    expect(onChange).toHaveBeenCalledWith('use_case', 'Billing')
  })

  it('reports checkbox toggles as booleans', () => {
    const onChange = renderFields()
    fireEvent.click(screen.getByRole('checkbox', { name: /I read the docs/ }))
    expect(onChange).toHaveBeenCalledWith('read_docs', true)
  })

  it('renders a short select as visible one-tap choices, not a dropdown', () => {
    renderFields()
    expect(screen.queryByRole('combobox', { name: /Impact/ })).toBeNull()
    const group = screen.getByRole('radiogroup', { name: /Impact/ })
    expect(group).toBeTruthy()
  })

  it('reports a tapped choice by field key and marks it selected', () => {
    const onChange = renderFields()
    fireEvent.click(screen.getByRole('radio', { name: 'high' }))
    expect(onChange).toHaveBeenCalledWith('impact', 'high')
  })

  it('marks the current value as the checked choice', () => {
    renderFields({ impact: 'high' })
    expect(screen.getByRole('radio', { name: 'high' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'low' }).getAttribute('aria-checked')).toBe('false')
  })

  it('keeps selects with more than six options as a dropdown', () => {
    renderFields({ priority: 'p3' })
    const trigger = screen.getByRole('combobox', { name: /Priority/ })
    expect(trigger.textContent).toContain('p3')
  })
})

describe('<BoardCustomFields> guided fields', () => {
  const GUIDED: BoardCustomField[] = [
    {
      key: 'video',
      label: 'Video link',
      type: 'url',
      required: true,
      helpText: 'Paste the link.\nSecond line.',
      warnDomains: ['youtube.com', 'youtu.be'],
      warnMessage: 'Prefer YouTube links',
    },
    { key: 'when', label: 'When', type: 'datetime', required: false },
    { key: 'ids', label: 'Game IDs', type: 'id_list', required: true, placeholder: '#7' },
    {
      key: 'nick',
      label: 'Nickname',
      type: 'text',
      required: false,
      pattern: { regex: '^[a-z]+$', message: 'Letters only' },
    },
  ]

  it('shows help text and placeholders', () => {
    renderWith({ fields: GUIDED, values: {}, onChange: vi.fn() })
    expect(screen.getByText(/Paste the link\./)).toBeTruthy()
    expect(screen.getByLabelText(/Game IDs/).getAttribute('placeholder')).toBe('#7')
    expect(screen.getByLabelText(/Video link/)).toHaveProperty('type', 'url')
    expect(screen.getByLabelText(/When/)).toHaveProperty('type', 'datetime-local')
  })

  it('shows no error until the field is visited, then on blur', () => {
    renderWith({ fields: GUIDED, values: { ids: '' }, onChange: vi.fn() })
    expect(screen.queryByText('This field is required')).toBeNull()
    fireEvent.blur(screen.getByLabelText(/Game IDs/))
    expect(screen.getAllByText('This field is required')).toHaveLength(1)
    expect(screen.getByLabelText(/Game IDs/).getAttribute('aria-invalid')).toBe('true')
  })

  it('shows every error after a failed submit attempt', () => {
    renderWith({ fields: GUIDED, values: { ids: '' }, onChange: vi.fn(), showAllErrors: true })
    expect(screen.getAllByText('This field is required')).toHaveLength(2)
  })

  it('shows the admin message for a pattern mismatch', () => {
    renderWith({ fields: GUIDED, values: { nick: 'ABC' }, onChange: vi.fn() })
    fireEvent.blur(screen.getByLabelText(/Nickname/))
    expect(screen.getByText('Letters only')).toBeTruthy()
  })

  it('shows an amber warning for an off-domain link without an error', () => {
    renderWith({
      fields: GUIDED,
      values: { video: 'https://vimeo.com/1' },
      onChange: vi.fn(),
    })
    const warning = screen.getByText('Prefer YouTube links')
    expect(warning.closest('p')?.className).toContain('amber')
    expect(screen.getByLabelText(/Video link/).getAttribute('aria-invalid')).toBeNull()
  })

  it('does not warn for an allowed domain', () => {
    renderWith({
      fields: GUIDED,
      values: { video: 'https://www.youtube.com/watch?v=1' },
      onChange: vi.fn(),
    })
    expect(screen.queryByText('Prefer YouTube links')).toBeNull()
  })

  it('reports a datetime as an ISO instant', () => {
    const onChange = vi.fn()
    renderWith({ fields: GUIDED, values: {}, onChange })
    fireEvent.change(screen.getByLabelText(/When/), { target: { value: '2026-05-01T10:30' } })
    const [key, value] = onChange.mock.calls[0]
    expect(key).toBe('when')
    expect(value).toBe(new Date('2026-05-01T10:30').toISOString())
  })
})
