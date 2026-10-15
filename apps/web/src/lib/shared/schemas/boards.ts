import { z } from 'zod'
import {
  ACCESS_TIERS,
  ACCESS_TIER_RANK,
  MODERATION_RULE_VALUES,
  REPLY_POLICIES,
  BOARD_KINDS,
  BOARD_CUSTOM_FIELD_TYPES,
  type BoardAccess,
} from '@/lib/shared/db-types'
import {
  compilePostCustomFieldPattern,
  POST_CUSTOM_FIELD_PATTERN_MAX_LENGTH,
} from '@/lib/shared/post-custom-fields'

/**
 * Create-board preset. Maps to a BoardAccess matrix on the server:
 *   - 'public'  → view=anonymous, vote/comment/submit=authenticated
 *   - 'private' → view/vote/comment/submit=team
 *   - 'reports' → a public report board: anyone views, sign-in to file or
 *                 reply, nobody votes, only the reporter and team reply
 *   - 'private-reports' → like 'reports', but only the reporter and the team
 *                 can read a report (view=team; see report-privacy.ts)
 *
 * Finer-grained access (segments, asymmetric tiers) is set after create
 * via the Access tab — admin-only and audited.
 */
export const boardPresetSchema = z.enum(['public', 'private', 'reports', 'private-reports'])
export type BoardPreset = z.infer<typeof boardPresetSchema>

/**
 * Translate the create-modal preset into the explicit BoardAccess
 * matrix the column stores. Shared between the create server-fn (real
 * insert) and the client mutation hook (optimistic row) so both sides
 * agree on the shape — drift here would surface as a flicker on create.
 */
const INHERIT_MODERATION = {
  anonPosts: 'inherit',
  signedPosts: 'inherit',
  comments: 'inherit',
} as const

/**
 * Fill leftover board.access rows that predate vote/comment/moderation.
 * Missing moderation is inherit (workspace default), not a crash.
 *
 * `replyPolicy` is PRESERVED when present and never injected when absent:
 * absent is already the permissive default (resolveReplyPolicy), and adding
 * the key here would make a normalized legacy row stop deep-equalling
 * DEFAULT_BOARD_ACCESS.
 */
export function normalizeBoardAccess(access: Partial<BoardAccess> | null | undefined): BoardAccess {
  const view = access?.view ?? 'team'
  const submit = access?.submit ?? view
  const vote = access?.vote ?? submit
  const comment = access?.comment ?? submit
  const segments = access?.segments
  const moderation = access?.moderation
  return {
    view,
    vote,
    comment,
    submit,
    segments: {
      view: segments?.view ?? [],
      vote: segments?.vote ?? [],
      comment: segments?.comment ?? [],
      submit: segments?.submit ?? [],
    },
    moderation: {
      anonPosts: moderation?.anonPosts ?? INHERIT_MODERATION.anonPosts,
      signedPosts: moderation?.signedPosts ?? INHERIT_MODERATION.signedPosts,
      comments: moderation?.comments ?? INHERIT_MODERATION.comments,
    },
    ...(access?.replyPolicy ? { replyPolicy: access.replyPolicy } : {}),
    ...(access?.kind ? { kind: access.kind } : {}),
  }
}

export function accessForPreset(preset: BoardPreset): BoardAccess {
  if (preset === 'reports') {
    // Created as a report board from the start, so it is never briefly an
    // ordinary feedback board on the portal. Same preset the Access tab's
    // "Public report board" switch applies.
    return {
      kind: 'reports',
      view: 'anonymous',
      vote: 'team',
      comment: 'authenticated',
      submit: 'authenticated',
      segments: { view: [], vote: [], comment: [], submit: [] },
      moderation: { anonPosts: 'inherit', signedPosts: 'inherit', comments: 'inherit' },
      replyPolicy: 'author-only',
    }
  }
  if (preset === 'private-reports') {
    return { ...accessForPreset('reports'), view: 'team' }
  }
  if (preset === 'private') {
    return {
      view: 'team',
      vote: 'team',
      comment: 'team',
      submit: 'team',
      segments: { view: [], vote: [], comment: [], submit: [] },
      moderation: { anonPosts: 'inherit', signedPosts: 'inherit', comments: 'inherit' },
    }
  }
  // 'public' — asymmetric: anyone views, sign-in required for vote/comment/submit.
  return {
    view: 'anonymous',
    vote: 'authenticated',
    comment: 'authenticated',
    submit: 'authenticated',
    segments: { view: [], vote: [], comment: [], submit: [] },
    moderation: { anonPosts: 'inherit', signedPosts: 'inherit', comments: 'inherit' },
  }
}

export type AccessPresetKind = 'public' | 'private' | 'custom'

function segmentsEmpty(access: BoardAccess): boolean {
  return (
    access.segments.view.length === 0 &&
    access.segments.vote.length === 0 &&
    access.segments.comment.length === 0 &&
    access.segments.submit.length === 0
  )
}

function sameActionTiers(a: BoardAccess, b: BoardAccess): boolean {
  return a.view === b.view && a.vote === b.vote && a.comment === b.comment && a.submit === b.submit
}

/**
 * Classify a stored access matrix as one of the two create-time presets,
 * or `custom` when the four action tiers or any segment allowlist differ.
 * Moderation is ignored — it is a separate policy surface.
 */
export function presetForAccess(access: BoardAccess): AccessPresetKind {
  if (!segmentsEmpty(access)) return 'custom'
  if (sameActionTiers(access, accessForPreset('public'))) return 'public'
  if (sameActionTiers(access, accessForPreset('private'))) return 'private'
  return 'custom'
}

export const createBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(100),
  description: z.string().max(500).optional(),
  preset: boardPresetSchema.default('public'),
})

/** Longest rules text a report board can carry. */
export const BOARD_RULES_MAX_LENGTH = 10000

export const BOARD_CUSTOM_FIELDS_MAX = 20
export const BOARD_CUSTOM_FIELD_OPTIONS_MAX = 50

const optionalText = (max: number) => z.string().max(max).optional()

/**
 * One configurable board intake field (see `BoardCustomField`). Strict so
 * unknown keys are rejected.
 */
export const boardCustomFieldSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
    label: z.string().trim().min(1, 'Label is required').max(120),
    type: z.enum(BOARD_CUSTOM_FIELD_TYPES),
    required: z.boolean(),
    options: z
      .array(z.string().trim().min(1).max(120))
      .max(BOARD_CUSTOM_FIELD_OPTIONS_MAX)
      .optional(),
    helpText: optionalText(1000),
    placeholder: optionalText(200),
    pattern: z
      .object({
        regex: z.string().min(1).max(POST_CUSTOM_FIELD_PATTERN_MAX_LENGTH),
        message: z.string().trim().min(1).max(300),
      })
      .strict()
      .optional(),
    warnDomains: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    warnOlderThanHours: z.number().int().positive().max(87_600).optional(),
    warnMessage: optionalText(300),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (field.type === 'select' && !(field.options?.length ?? 0)) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option' })
    }
    if (field.pattern) {
      if (field.type !== 'text' && field.type !== 'long_text') {
        ctx.addIssue({
          code: 'custom',
          path: ['pattern'],
          message: 'A pattern only applies to text fields',
        })
      } else if (!compilePostCustomFieldPattern(field.pattern.regex)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pattern', 'regex'],
          message: 'Not a valid regular expression',
        })
      }
    }
  })

/** Team-editable board settings. Strict so unknown keys are rejected. */
export const boardSettingsSchema = z
  .object({
    roadmapStatusIds: z.array(z.string()).optional(),
    customFields: z
      .array(boardCustomFieldSchema)
      .max(BOARD_CUSTOM_FIELDS_MAX)
      .superRefine((fields, ctx) => {
        const seen = new Set<string>()
        fields.forEach((f, i) => {
          if (seen.has(f.key)) {
            ctx.addIssue({ code: 'custom', path: [i, 'key'], message: 'Duplicate field key' })
          }
          seen.add(f.key)
        })
      })
      .optional(),
    rulesMarkdown: z.string().max(BOARD_RULES_MAX_LENGTH).optional(),
  })
  .strict()

export const updateBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(100),
  description: z.string().max(500).optional(),
  /** Report boards only: Markdown rules saved to `settings.rulesMarkdown`. */
  rulesMarkdown: z.string().max(BOARD_RULES_MAX_LENGTH).optional(),
})

export const deleteBoardSchema = z.object({
  confirmName: z.string(),
})

export type CreateBoardInput = z.input<typeof createBoardSchema>
export type CreateBoardOutput = z.infer<typeof createBoardSchema>
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>
export type DeleteBoardInput = z.infer<typeof deleteBoardSchema>

// ============================================
// Board access (view/comment/submit + segments + approval)
// ============================================
//
// Kept alongside the other board schemas (and out of `server/`) so client
// code can import without dragging the @quackback/db/client guard. Only
// imports zod + @quackback/db/types — both are runtime-safe in any env.

const tierSchema = z.enum(ACCESS_TIERS)
const moderationRuleSchema = z.enum(MODERATION_RULE_VALUES)
const replyPolicySchema = z.enum(REPLY_POLICIES)
const boardKindSchema = z.enum(BOARD_KINDS)

/**
 * Validation for the per-action `BoardAccess` payload
 * (view/vote/comment/submit + per-action segments + tri-state moderation).
 * Enforces the spec's tier-rank invariants so a board can't accidentally
 * land in a contradictory state (e.g. anonymous voting on a team-only-
 * visible board).
 *
 * Invariants:
 *  - `vote.rank >= view.rank` (can't be more permissive than view)
 *  - `comment.rank >= view.rank`
 *  - `submit.rank >= view.rank`
 *  - For each action, if its tier is `'segments'`, the matching
 *    `segments[action]` array must be non-empty (an empty allowlist
 *    would hide the board from everyone in that tier)
 *  - `segments[action].length <= 50` per action (board capacity cap)
 *
 * Moderation rules are tri-state (`inherit | on | off`) — see
 * resolveModerationRule in policy/posts.ts for how `inherit` resolves
 * against the workspace requireApproval default.
 *
 * `replyPolicy` is optional: an omitted key is the permissive default
 * (`'anyone'`), so a board that never touches the setting keeps writing the
 * exact shape it always did. It carries no tier-rank invariant — it narrows
 * WHO may reply within the comment tier, per post, and never widens it.
 */
export const boardAccessSchema = z
  .object({
    view: tierSchema,
    vote: tierSchema,
    comment: tierSchema,
    submit: tierSchema,
    segments: z.object({
      view: z.array(z.string()).max(50, 'At most 50 segments per board.'),
      vote: z.array(z.string()).max(50, 'At most 50 segments per board.'),
      comment: z.array(z.string()).max(50, 'At most 50 segments per board.'),
      submit: z.array(z.string()).max(50, 'At most 50 segments per board.'),
    }),
    moderation: z.object({
      anonPosts: moderationRuleSchema,
      signedPosts: moderationRuleSchema,
      comments: moderationRuleSchema,
    }),
    replyPolicy: replyPolicySchema.optional(),
    // Optional board purpose; absent is a feedback board (see BOARD_KINDS).
    kind: boardKindSchema.optional(),
  })
  .superRefine((val, ctx) => {
    // Report boards take contributions from signed-in accounts only, so a
    // report board can't be saved with an "Anyone" submit or comment tier.
    if (val.kind === 'reports') {
      for (const action of ['submit', 'comment'] as const) {
        if (val[action] === 'anonymous') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [action],
            message: 'A report board requires an account to submit and comment.',
          })
        }
      }
    }
    // A private report board (kind reports + view team) is the one place a
    // contribution tier may be MORE open than view: signed-in accounts file and
    // reply on it while the policy layer shows each of them only their own
    // reports. Only 'authenticated' gets the exemption.
    const privateReport = val.kind === 'reports' && val.view === 'team'
    const exempt = (tier: string) => privateReport && tier === 'authenticated'
    if (ACCESS_TIER_RANK[val.vote] < ACCESS_TIER_RANK[val.view] && !exempt(val.vote)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vote'],
        message: 'Vote tier cannot be more permissive than view.',
      })
    }
    if (ACCESS_TIER_RANK[val.comment] < ACCESS_TIER_RANK[val.view] && !exempt(val.comment)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['comment'],
        message: 'Comment tier cannot be more permissive than view.',
      })
    }
    if (ACCESS_TIER_RANK[val.submit] < ACCESS_TIER_RANK[val.view] && !exempt(val.submit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['submit'],
        message: 'Submit tier cannot be more permissive than view.',
      })
    }
    // Per-action segments-non-empty when that action is set to 'segments'.
    for (const action of ['view', 'vote', 'comment', 'submit'] as const) {
      if (val[action] === 'segments' && val.segments[action].length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['segments', action],
          message: `Pick at least one segment for ${action} — empty allowlist hides the board.`,
        })
      }
    }
  })
