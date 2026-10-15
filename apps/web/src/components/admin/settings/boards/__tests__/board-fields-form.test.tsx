// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { BoardId } from '@quackback/ids'
import type { BoardCustomField } from '@/lib/shared/db-types'

const mutate = vi.fn()
vi.mock('@/lib/client/mutations', () => ({
  useUpdateBoard: () => ({ mutate, isPending: false, isError: false, error: null }),
}))

import { BoardFieldsForm } from '../board-fields-form'

const FIELDS: BoardCustomField[] = [
  { key: 'video', label: 'Video link', type: 'url', required: true },
  { key: 'ids', label: 'Game IDs', type: 'id_list', required: false },
]

function renderForm(fields: BoardCustomField[] = FIELDS) {
  return render(
    <BoardFieldsForm
      board={{ id: 'board_01test' as BoardId, name: 'Reports', settings: { customFields: fields } }}
    />
  )
}

function labels() {
  return screen
    .getAllByRole('button', { name: /^Edit / })
    .map((b) => b.getAttribute('aria-label')?.replace('Edit ', ''))
}

beforeEach(() => mutate.mockReset())

describe('<BoardFieldsForm>', () => {
  it('lists the saved fields with type and required badges', () => {
    renderForm()
    expect(labels()).toEqual(['Video link', 'Game IDs'])
    expect(screen.getByText('Link (URL)')).toBeTruthy()
    expect(screen.getByText('Required')).toBeTruthy()
  })

  it('keeps Save disabled until something changes', () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Save fields' })).toHaveProperty('disabled', true)
  })

  it('reorders fields and saves only the customFields setting', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Move Game IDs up' }))
    expect(labels()).toEqual(['Game IDs', 'Video link'])
    fireEvent.click(screen.getByRole('button', { name: 'Save fields' }))
    expect(mutate).toHaveBeenCalledTimes(1)
    const input = mutate.mock.calls[0]![0]
    expect(input.id).toBe('board_01test')
    expect(input.settings.customFields.map((f: BoardCustomField) => f.key)).toEqual([
      'ids',
      'video',
    ])
    expect(Object.keys(input.settings)).toEqual(['customFields'])
  })

  it('adds a field with a key built from its name', () => {
    renderForm([])
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }))
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'Match time' } })
    expect((screen.getByLabelText('Key') as HTMLInputElement).value).toBe('match_time')
    fireEvent.change(screen.getByLabelText('Help text'), { target: { value: 'When it began' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save fields' }))
    expect(mutate.mock.calls[0]![0].settings.customFields).toEqual([
      expect.objectContaining({
        key: 'match_time',
        label: 'Match time',
        type: 'text',
        required: false,
        helpText: 'When it began',
      }),
    ])
  })

  it('locks the key of an existing field', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Video link' }))
    const key = screen.getByLabelText('Key') as HTMLInputElement
    expect(key.value).toBe('video')
    expect(key.disabled).toBe(true)
  })

  it('refuses an invalid regular expression', () => {
    renderForm([])
    fireEvent.click(screen.getByRole('button', { name: /Add field/ }))
    fireEvent.change(screen.getByLabelText('Field name'), { target: { value: 'Nick' } })
    fireEvent.change(screen.getByLabelText('Pattern (regular expression)'), {
      target: { value: '(' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }))
    expect(screen.getByText('Not a valid regular expression')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Edit Nick/ })).toBeNull()
  })

  it('removes a field after confirmation', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Delete Game IDs' }))
    const dialog = screen.getByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete field' }))
    expect(labels()).toEqual(['Video link'])
  })
})
