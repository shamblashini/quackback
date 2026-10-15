import { describe, it, expect } from 'vitest'
import {
  validatePostCustomFieldValues as validate,
  getPostCustomFieldWarnings,
  normalizeIdList,
  POST_CUSTOM_FIELD_TEXT_MAX_LENGTH,
} from '../post-custom-fields'
import type { BoardCustomField } from '../db-types'

const f = (over: Partial<BoardCustomField>): BoardCustomField => ({
  key: 'k',
  label: 'Field',
  type: 'text',
  required: false,
  ...over,
})

function errorsOf(field: BoardCustomField, value: unknown) {
  const r = validate([field], { k: value })
  return r.ok ? [] : r.errors
}
function valueOf(field: BoardCustomField, value: unknown) {
  const r = validate([field], { k: value })
  return r.ok ? r.values.k : undefined
}

describe('validatePostCustomFieldValues', () => {
  it('requires required fields and skips empty optional ones', () => {
    expect(errorsOf(f({ required: true }), '  ')[0]).toMatchObject({ key: 'k', code: 'required' })
    expect(validate([f({})], {})).toEqual({ ok: true, values: {} })
  })

  it('drops unknown keys', () => {
    const r = validate([f({})], { k: 'a', evil: 'b' })
    expect(r).toEqual({ ok: true, values: { k: 'a' } })
  })

  it('caps text length', () => {
    expect(errorsOf(f({}), 'x'.repeat(POST_CUSTOM_FIELD_TEXT_MAX_LENGTH + 1))[0].code).toBe(
      'too_long'
    )
  })

  it('validates number, select, date, checkbox as before', () => {
    expect(valueOf(f({ type: 'number' }), '12')).toBe(12)
    expect(errorsOf(f({ type: 'number' }), 'abc')[0].code).toBe('number')
    const select = f({ type: 'select', options: ['a', 'b'] })
    expect(valueOf(select, 'a')).toBe('a')
    expect(errorsOf(select, 'z')[0].code).toBe('option')
    expect(valueOf(f({ type: 'date' }), '2026-01-02')).toBe('2026-01-02')
    expect(errorsOf(f({ type: 'date' }), 'nope')[0].code).toBe('date')
    expect(errorsOf(f({ type: 'checkbox', required: true }), false)[0].code).toBe('required')
    expect(valueOf(f({ type: 'checkbox' }), true)).toBe(true)
  })

  describe('pattern', () => {
    const field = f({ pattern: { regex: '^#\\d+$', message: 'Use #123' } })
    it('accepts a match and reports the custom message otherwise', () => {
      expect(valueOf(field, '#12')).toBe('#12')
      expect(errorsOf(field, 'abc')[0]).toMatchObject({ code: 'pattern', message: 'Use #123' })
    })
    it('ignores an invalid or oversized regex instead of blocking', () => {
      expect(valueOf(f({ pattern: { regex: '(', message: 'm' } }), 'anything')).toBe('anything')
      expect(valueOf(f({ pattern: { regex: 'a'.repeat(300), message: 'm' } }), 'anything')).toBe(
        'anything'
      )
    })
    it('does not run on optional empty values', () => {
      expect(validate([field], { k: '' })).toEqual({ ok: true, values: {} })
    })
  })

  describe('datetime', () => {
    const field = f({ type: 'datetime' })
    it('accepts ISO with offset and rejects bare local values', () => {
      expect(valueOf(field, '2026-05-01T10:30:00.000Z')).toBe('2026-05-01T10:30:00.000Z')
      expect(valueOf(field, '2026-05-01T10:30+02:00')).toBe('2026-05-01T10:30+02:00')
      expect(errorsOf(field, '2026-05-01T10:30')[0].code).toBe('datetime')
      expect(errorsOf(field, 'tomorrow')[0].code).toBe('datetime')
      expect(errorsOf(field, '2026-13-45T10:30:00Z')[0].code).toBe('datetime')
    })
  })

  describe('url', () => {
    const field = f({ type: 'url' })
    it('accepts http(s) only', () => {
      expect(valueOf(field, ' https://youtu.be/abc ')).toBe('https://youtu.be/abc')
      expect(valueOf(field, 'http://example.com')).toBe('http://example.com')
      expect(errorsOf(field, 'javascript:alert(1)')[0].code).toBe('url')
      expect(errorsOf(field, 'ftp://x.com')[0].code).toBe('url')
      expect(errorsOf(field, 'not a url')[0].code).toBe('url')
    })
  })

  describe('id_list', () => {
    const field = f({ type: 'id_list' })
    it('normalises every accepted spelling to "#1, #12"', () => {
      for (const input of ['1 12', '#1,#12', ' #1 , 12 ', '1,12', '#1  #12']) {
        expect(valueOf(field, input)).toBe('#1, #12')
      }
      expect(valueOf(field, '7')).toBe('#7')
    })
    it('rejects non-numeric ids', () => {
      expect(errorsOf(field, 'abc')[0].code).toBe('id_list')
      expect(errorsOf(field, '#1, x')[0].code).toBe('id_list')
      expect(errorsOf(field, '##1')[0].code).toBe('id_list')
      expect(normalizeIdList('')).toBeNull()
    })
  })
})

describe('getPostCustomFieldWarnings', () => {
  const now = Date.parse('2026-05-10T12:00:00Z')
  const url = f({
    type: 'url',
    warnDomains: ['youtube.com', 'youtu.be'],
    warnMessage: 'Use YouTube',
  })
  const when = f({ type: 'datetime', warnOlderThanHours: 48, warnMessage: 'Too old' })

  it('warns for a link off the allowed domains, not for subdomains or www', () => {
    const w = (v: string) => getPostCustomFieldWarnings([url], { k: v }, now)
    expect(w('https://vimeo.com/1')).toEqual([{ key: 'k', message: 'Use YouTube' }])
    expect(w('https://www.youtube.com/watch?v=1')).toEqual([])
    expect(w('https://m.youtube.com/x')).toEqual([])
    expect(w('https://youtu.be/x')).toEqual([])
    expect(w('https://evilyoutube.com/x')).toHaveLength(1)
  })

  it('warns for a datetime older than the limit', () => {
    const w = (v: string) => getPostCustomFieldWarnings([when], { k: v }, now)
    expect(w('2026-05-01T00:00:00Z')).toHaveLength(1)
    expect(w('2026-05-09T12:00:00Z')).toEqual([])
  })

  it('stays silent for empty / invalid answers and never affects validation', () => {
    expect(getPostCustomFieldWarnings([url, when], { k: '' }, now)).toEqual([])
    expect(getPostCustomFieldWarnings([url], { k: 'not a url' }, now)).toEqual([])
    expect(validate([url], { k: 'https://vimeo.com/1' }).ok).toBe(true)
    expect(validate([when], { k: '2020-01-01T00:00:00Z' }).ok).toBe(true)
  })
})
