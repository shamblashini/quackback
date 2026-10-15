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
    expect(boardSettingsSchema.safeParse({ customFields: [] }).success).toBe(false)
    expect(boardSettingsSchema.safeParse({ rulesMarkdown: 'x', other: 1 }).success).toBe(false)
  })
})
