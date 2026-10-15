import { describe, it, expect } from 'vitest'
import { boardSettingsSchema, BOARD_RULES_MAX_LENGTH } from '../boards'

describe('boardSettingsSchema', () => {
  it('accepts roadmapStatusIds and rulesMarkdown together or alone', () => {
    expect(boardSettingsSchema.safeParse({ roadmapStatusIds: ['status_1'] }).success).toBe(true)
    expect(boardSettingsSchema.safeParse({ rulesMarkdown: '# Rules\n\n- be kind' }).success).toBe(
      true
    )
    expect(
      boardSettingsSchema.safeParse({ roadmapStatusIds: [], rulesMarkdown: 'x' }).success
    ).toBe(true)
  })

  it('accepts an empty rules string (clears the rules)', () => {
    expect(boardSettingsSchema.safeParse({ rulesMarkdown: '' }).success).toBe(true)
  })

  it('caps the rules length', () => {
    expect(
      boardSettingsSchema.safeParse({ rulesMarkdown: 'a'.repeat(BOARD_RULES_MAX_LENGTH) }).success
    ).toBe(true)
    expect(
      boardSettingsSchema.safeParse({ rulesMarkdown: 'a'.repeat(BOARD_RULES_MAX_LENGTH + 1) })
        .success
    ).toBe(false)
  })

  it('stays strict about unknown keys', () => {
    expect(boardSettingsSchema.safeParse({ nope: [] }).success).toBe(false)
    expect(boardSettingsSchema.safeParse({ rulesMarkdown: 'x', other: 1 }).success).toBe(false)
  })
})

describe('boardSettingsSchema customFields', () => {
  const base = { key: 'link', label: 'Link', type: 'text', required: false } as const
  const parse = (fields: unknown[]) => boardSettingsSchema.safeParse({ customFields: fields })

  it('accepts every field type and the optional keys', () => {
    const result = parse([
      { ...base, key: 'a', helpText: 'Help\nme', placeholder: 'x' },
      { ...base, key: 'b', type: 'datetime', warnOlderThanHours: 48, warnMessage: 'old' },
      {
        ...base,
        key: 'c',
        type: 'url',
        warnDomains: ['youtube.com', 'youtu.be'],
        warnMessage: 'not youtube',
      },
      { ...base, key: 'd', type: 'id_list' },
      { ...base, key: 'e', type: 'select', options: ['x', 'y'] },
      { ...base, key: 'f', pattern: { regex: '^#\\d+$', message: 'bad' } },
    ])
    expect(result.success).toBe(true)
  })

  it('drops blank optional strings', () => {
    const result = parse([{ ...base, helpText: '  ', placeholder: '' }])
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.customFields?.[0]?.helpText).toBeUndefined()
      expect(result.data.customFields?.[0]?.placeholder).toBeUndefined()
    }
  })

  it('rejects unknown keys and types', () => {
    expect(parse([{ ...base, extra: 1 }]).success).toBe(false)
    expect(parse([{ ...base, type: 'color' }]).success).toBe(false)
  })

  it('caps counts and lengths', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ ...base, key: `k${i}` }))
    expect(parse(many).success).toBe(false)
    expect(parse(many.slice(0, 20)).success).toBe(true)
    expect(parse([{ ...base, label: 'x'.repeat(121) }]).success).toBe(false)
    expect(parse([{ ...base, helpText: 'x'.repeat(1001) }]).success).toBe(false)
    expect(parse([{ ...base, helpText: 'x'.repeat(1000) }]).success).toBe(true)
  })

  it('rejects duplicate and malformed keys', () => {
    expect(parse([base, base]).success).toBe(false)
    expect(parse([{ ...base, key: 'Bad Key' }]).success).toBe(false)
  })

  it('requires options for select fields', () => {
    expect(parse([{ ...base, type: 'select' }]).success).toBe(false)
  })

  it('refuses an invalid or oversized regex and a pattern on a non-text field', () => {
    expect(parse([{ ...base, pattern: { regex: '(', message: 'm' } }]).success).toBe(false)
    expect(parse([{ ...base, pattern: { regex: 'a'.repeat(201), message: 'm' } }]).success).toBe(
      false
    )
    expect(
      parse([{ ...base, type: 'number', pattern: { regex: '^1$', message: 'm' } }]).success
    ).toBe(false)
  })
})
