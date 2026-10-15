/**
 * Report-board rules for comments: no edits from anyone, no deletes by
 * non-team actors, no reactions from anyone.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PostCommentId, PrincipalId } from '@quackback/ids'
import type { Actor } from '@/lib/server/policy/types'

const mockCommentFindFirst = vi.fn()
const mockHasReplyFindMany = vi.fn()
const mockSelectRows: { current: unknown[] } = { current: [] }
const mockInsert = vi.fn()

vi.mock('@/lib/server/db', async (importOriginal) => {
  const select = () => {
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.innerJoin = () => chain
    chain.leftJoin = () => chain
    chain.where = () => chain
    chain.limit = async () => mockSelectRows.current
    return chain
  }
  return {
    ...(await importOriginal<typeof import('@/lib/server/db')>()),
    db: {
      query: {
        postComments: {
          findFirst: (...args: unknown[]) => mockCommentFindFirst(...args),
          findMany: (...args: unknown[]) => mockHasReplyFindMany(...args),
        },
      },
      select,
      insert: (...args: unknown[]) => mockInsert(...args),
    },
  }
})

vi.mock('@/lib/server/domains/posts/post.access', () => ({
  assertCommentViewable: vi.fn().mockResolvedValue(undefined),
}))

const COMMENT_ID = 'post_comment_1' as PostCommentId
const REPORTER = {
  principalId: 'principal_reporter' as PrincipalId,
  role: 'user' as const,
}
const TEAM = { principalId: 'principal_team' as PrincipalId, role: 'admin' as const }

const comment = (access: unknown) => ({
  id: COMMENT_ID,
  principalId: REPORTER.principalId,
  deletedAt: null,
  post: { id: 'post_1', board: { access } },
})

describe('canDeleteComment on a report board', () => {
  beforeEach(() => {
    mockCommentFindFirst.mockReset()
    mockHasReplyFindMany.mockReset().mockResolvedValue([])
  })

  it('refuses the reporter deleting their own reply', async () => {
    mockCommentFindFirst.mockResolvedValue(comment({ kind: 'reports' }))
    const { canDeleteComment } = await import('../comment.permissions')
    const result = await canDeleteComment(COMMENT_ID, REPORTER)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/stay public/i)
  })

  it('still lets the author delete on a feedback board', async () => {
    mockCommentFindFirst.mockResolvedValue(comment({ kind: 'feedback' }))
    const { canDeleteComment } = await import('../comment.permissions')
    expect((await canDeleteComment(COMMENT_ID, REPORTER)).allowed).toBe(true)
  })

  it('lets the team delete a reply on a report board', async () => {
    mockCommentFindFirst.mockResolvedValue(comment({ kind: 'reports' }))
    const { canDeleteComment } = await import('../comment.permissions')
    expect((await canDeleteComment(COMMENT_ID, TEAM)).allowed).toBe(true)
  })
})

describe('canEditComment on a report board', () => {
  beforeEach(() => {
    mockCommentFindFirst.mockReset()
    mockHasReplyFindMany.mockReset().mockResolvedValue([])
  })

  it('refuses the reporter editing their own reply', async () => {
    mockCommentFindFirst.mockResolvedValue(comment({ kind: 'reports' }))
    const { canEditComment } = await import('../comment.permissions')
    const result = await canEditComment(COMMENT_ID, REPORTER)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/cannot be edited/i)
  })

  it('refuses the team too: a report thread stays as written', async () => {
    mockCommentFindFirst.mockResolvedValue(comment({ kind: 'reports' }))
    const { canEditComment } = await import('../comment.permissions')
    expect((await canEditComment(COMMENT_ID, TEAM)).allowed).toBe(false)
  })

  it('still lets the author edit on a feedback board', async () => {
    mockCommentFindFirst.mockResolvedValue(comment({ kind: 'feedback' }))
    const { canEditComment } = await import('../comment.permissions')
    expect((await canEditComment(COMMENT_ID, REPORTER)).allowed).toBe(true)
  })
})

describe('addReaction on a report board', () => {
  const actor = { principalId: TEAM.principalId, principalType: 'user' } as unknown as Actor

  beforeEach(() => {
    mockInsert.mockReset()
  })

  it('refuses every actor, team included, before writing anything', async () => {
    mockSelectRows.current = [{ access: { kind: 'reports' } }]
    const { addReaction } = await import('../comment.reactions')
    await expect(addReaction(COMMENT_ID, '👍', TEAM.principalId, actor)).rejects.toMatchObject({
      code: 'REACTION_NOT_ALLOWED',
    })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
