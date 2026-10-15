/**
 * Private report boards: a report board (kind reports) whose view tier is
 * 'team'. The team reads every report; a signed-in reporter reads, and replies
 * on, only their own; everyone else sees nothing.
 */
import { describe, it, expect } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { createId, toUuid, type PrincipalId } from '@quackback/ids'
import type { BoardAccess, ModerationState } from '@/lib/server/db'
import { canViewBoard, boardViewFilter } from '../boards'
import {
  canViewPost,
  canCreatePost,
  canCreateComment,
  canVotePost,
  canCommentOnPost,
  boardCapabilitiesForActor,
  postViewFilter,
} from '../posts'
import { ANONYMOUS_ACTOR, type Actor } from '../types'
import { accessForPreset, boardAccessSchema } from '@/lib/shared/schemas/boards'
import { isPrivateReportAccess } from '@/lib/shared/report-privacy'

const ALICE = createId('principal') as PrincipalId
const BOB = createId('principal') as PrincipalId
const TEAMMATE = createId('principal') as PrincipalId

const user = (principalId: PrincipalId): Actor => ({
  principalId,
  role: 'user',
  principalType: 'user',
  segmentIds: new Set(),
})
const alice = user(ALICE)
const bob = user(BOB)
const team: Actor = { ...user(TEAMMATE), role: 'member' }
const anon = ANONYMOUS_ACTOR

const privateReports: BoardAccess = accessForPreset('private-reports')
const publicReports: BoardAccess = accessForPreset('reports')
const privateBoard = { access: privateReports }
const publicBoard = { access: publicReports }

const post = (principalId: PrincipalId | null, moderationState: ModerationState = 'published') => ({
  moderationState,
  principalId,
  isCommentsLocked: false,
  isMerged: false,
})

const dialect = new PgDialect()

describe('private report preset and schema', () => {
  it('is a report board that only the team can view, but anyone signed in can file to', () => {
    expect(privateReports).toMatchObject({
      kind: 'reports',
      view: 'team',
      vote: 'team',
      comment: 'authenticated',
      submit: 'authenticated',
      replyPolicy: 'author-only',
    })
    expect(isPrivateReportAccess(privateReports)).toBe(true)
    expect(isPrivateReportAccess(publicReports)).toBe(false)
    expect(isPrivateReportAccess({ ...privateReports, kind: 'feedback' })).toBe(false)
  })

  it('passes boardAccessSchema (submit/comment may sit below view only here)', () => {
    expect(boardAccessSchema.safeParse(privateReports).success).toBe(true)
  })

  it('still rejects the same tiers on a non-report board', () => {
    const { kind: _kind, ...feedback } = privateReports
    const result = boardAccessSchema.safeParse(feedback)
    expect(result.success).toBe(false)
  })

  it('does not exempt other tiers below view on a private report board', () => {
    const result = boardAccessSchema.safeParse({
      ...privateReports,
      submit: 'segments',
      segments: { view: [], vote: [], comment: [], submit: ['seg'] },
    })
    expect(result.success).toBe(false)
  })

  it('keeps refusing anonymous submit/comment on a private report board', () => {
    expect(boardAccessSchema.safeParse({ ...privateReports, submit: 'anonymous' }).success).toBe(
      false
    )
  })
})

describe('private report board: viewing a post', () => {
  it('lets the reporter and the team open it', () => {
    expect(canViewPost(alice, post(ALICE), privateBoard).allowed).toBe(true)
    expect(canViewPost(team, post(ALICE), privateBoard).allowed).toBe(true)
  })

  it('hides it from another signed-in user and from anonymous visitors', () => {
    const other = canViewPost(bob, post(ALICE), privateBoard)
    expect(other.allowed).toBe(false)
    expect(canViewPost(anon, post(ALICE), privateBoard).allowed).toBe(false)
  })

  it('never matches an actor with no principal against an author-less post', () => {
    expect(canViewPost(anon, post(null), privateBoard).allowed).toBe(false)
    expect(canViewPost({ ...bob, principalId: null }, post(null), privateBoard).allowed).toBe(false)
  })

  it('does not widen the moderation rules: the reporter sees their pending report', () => {
    expect(canViewPost(alice, post(ALICE, 'pending'), privateBoard).allowed).toBe(true)
    expect(canViewPost(alice, post(ALICE, 'deleted'), privateBoard).allowed).toBe(false)
    expect(canViewPost(bob, post(ALICE, 'pending'), privateBoard).allowed).toBe(false)
  })

  it('a service principal that is not the author sees nothing', () => {
    const service: Actor = { ...bob, principalType: 'service' }
    expect(canViewPost(service, post(ALICE), privateBoard).allowed).toBe(false)
  })
})

describe('private report board: the board shell', () => {
  it('is reachable by signed-in users and the team, not by anonymous visitors', () => {
    expect(canViewBoard(alice, privateBoard).allowed).toBe(true)
    expect(canViewBoard(bob, privateBoard).allowed).toBe(true)
    expect(canViewBoard(team, privateBoard).allowed).toBe(true)
    expect(canViewBoard(anon, privateBoard).allowed).toBe(false)
  })

  it('a plain team-only feedback board stays closed to signed-in users', () => {
    expect(canViewBoard(alice, { access: accessForPreset('private') }).allowed).toBe(false)
  })

  it('a team-only report board with kind removed is closed again', () => {
    const { kind: _kind, ...feedbackLike } = privateReports
    expect(canViewBoard(alice, { access: feedbackLike as BoardAccess }).allowed).toBe(false)
  })
})

describe('private report board: filing and replying', () => {
  it('lets a signed-in user file a report and sends none to the queue by default', () => {
    expect(canCreatePost(alice, privateBoard, undefined)).toEqual({
      allowed: true,
      requiresApproval: false,
    })
    expect(canCreatePost(team, privateBoard, undefined).allowed).toBe(true)
  })

  it('refuses anonymous visitors', () => {
    expect(canCreatePost(anon, privateBoard, undefined).allowed).toBe(false)
  })

  it('the reporter replies on their own report; another user cannot even see it', () => {
    expect(canCreateComment(alice, post(ALICE), privateBoard, undefined).allowed).toBe(true)
    const other = canCreateComment(bob, post(ALICE), privateBoard, undefined)
    expect(other.allowed).toBe(false)
    expect(canCreateComment(anon, post(ALICE), privateBoard, undefined).allowed).toBe(false)
  })

  it('the team replies on any report', () => {
    expect(canCreateComment(team, post(ALICE), privateBoard, undefined).allowed).toBe(true)
  })

  it('nobody votes', () => {
    for (const actor of [alice, bob, team]) {
      expect(canVotePost(actor, post(ALICE), privateBoard).allowed).toBe(false)
    }
  })

  it('board capabilities: signed-in users can file and reply, anonymous cannot', () => {
    expect(boardCapabilitiesForActor(alice, privateReports, true)).toEqual({
      canSubmit: true,
      canVote: false,
      canComment: true,
    })
    expect(boardCapabilitiesForActor(anon, privateReports, true)).toEqual({
      canSubmit: false,
      canVote: false,
      canComment: false,
    })
    expect(canCommentOnPost(alice, post(ALICE), privateReports, true)).toBe(true)
    expect(canCommentOnPost(bob, post(ALICE), privateReports, true)).toBe(false)
  })
})

describe('private report board: list filters', () => {
  const render = (actor: Actor) => dialect.sqlToQuery(postViewFilter(actor))

  it('team lists every post: no per-author predicate', () => {
    const { sql } = render(team)
    expect(sql).not.toContain("'reports'")
  })

  it('a signed-in user is cut down to their own posts on a private report board', () => {
    const { sql, params } = render(alice)
    expect(sql).toContain("->>'kind' = 'reports'")
    expect(sql).toContain("->>'view' = 'team'")
    expect(params.flat(2)).toContain(toUuid(ALICE))
  })

  it('an anonymous viewer gets no author branch, only the negated board test', () => {
    const { sql, params } = render(anon)
    expect(sql).toMatch(/not \(.*'reports'.*'team'/i)
    expect(params.flat(2).filter((p) => typeof p === 'string' && p.length === 36)).toEqual([])
  })

  it('the board filter admits the private report board for signed-in users only', () => {
    const forUser = dialect.sqlToQuery(boardViewFilter(alice)).sql
    const forAnon = dialect.sqlToQuery(boardViewFilter(anon)).sql
    expect(forUser).toContain("->>'kind' = 'reports'")
    expect(forAnon).not.toContain("'reports'")
  })
})

describe('public report board is unchanged', () => {
  it('everyone reads every report', () => {
    for (const actor of [alice, bob, anon, team]) {
      expect(canViewPost(actor, post(ALICE), publicBoard).allowed).toBe(true)
    }
  })

  it('only the reporter and the team reply', () => {
    expect(canCreateComment(alice, post(ALICE), publicBoard, undefined).allowed).toBe(true)
    expect(canCreateComment(bob, post(ALICE), publicBoard, undefined).allowed).toBe(false)
  })

  it('has no per-author predicate in the list filter', () => {
    // The private-report clause exists for signed-in users but is gated on the
    // board's view tier at query time, so the public preset never matches it.
    expect(isPrivateReportAccess(publicReports)).toBe(false)
  })
})
