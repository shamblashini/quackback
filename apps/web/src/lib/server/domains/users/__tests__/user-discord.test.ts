/**
 * Discord account lookups: batched in one query, and the team-only gate used
 * by portal-facing reads never touches the database for non-team actors.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrincipalId, UserId } from '@quackback/ids'
import type { Actor } from '@/lib/server/policy'

const hoisted = vi.hoisted(() => ({
  rows: [] as unknown[],
  select: vi.fn(),
}))

vi.mock('@/lib/server/db', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/server/db')>()
  const chain = () => {
    const c: Record<string, unknown> = {}
    c.from = () => c
    c.innerJoin = () => c
    c.where = () => c
    c.limit = () => Promise.resolve(hoisted.rows)
    c.then = (resolve: (v: unknown) => void) => resolve(hoisted.rows)
    return c
  }
  return {
    ...real,
    db: {
      select: (...args: unknown[]) => {
        hoisted.select(...args)
        return chain()
      },
    },
  }
})

const {
  getDiscordAccountIds,
  getDiscordAccountId,
  getDiscordAccountIdForPrincipal,
  resolveAuthorDiscordIdForActor,
} = await import('../user.discord')

const u1 = 'user_1' as UserId
const u2 = 'user_2' as UserId
const author = 'principal_author' as PrincipalId

const actor = (role: Actor['role'], principalType: Actor['principalType'] = 'user'): Actor => ({
  principalId: 'principal_viewer' as PrincipalId,
  role,
  principalType,
  segmentIds: new Set(),
})

beforeEach(() => {
  hoisted.rows = []
  hoisted.select.mockClear()
})

describe('getDiscordAccountIds', () => {
  it('maps user ids to discord ids with a single query', async () => {
    hoisted.rows = [
      { userId: u1, accountId: '111' },
      { userId: u2, accountId: '222' },
    ]
    const map = await getDiscordAccountIds([u1, u2, u1])
    expect(hoisted.select).toHaveBeenCalledTimes(1)
    expect(map.get(u1)).toBe('111')
    expect(map.get(u2)).toBe('222')
  })

  it('skips the query for an empty list', async () => {
    const map = await getDiscordAccountIds([])
    expect(map.size).toBe(0)
    expect(hoisted.select).not.toHaveBeenCalled()
  })

  it('omits users without a discord account', async () => {
    hoisted.rows = [{ userId: u1, accountId: '111' }]
    const map = await getDiscordAccountIds([u1, u2])
    expect(map.has(u2)).toBe(false)
  })
})

describe('single-user variants', () => {
  it('getDiscordAccountId returns the id or null', async () => {
    hoisted.rows = [{ userId: u1, accountId: '111' }]
    expect(await getDiscordAccountId(u1)).toBe('111')
    hoisted.rows = []
    expect(await getDiscordAccountId(u1)).toBeNull()
  })

  it('getDiscordAccountIdForPrincipal returns the id or null', async () => {
    hoisted.rows = [{ accountId: '333' }]
    expect(await getDiscordAccountIdForPrincipal(author)).toBe('333')
    hoisted.rows = []
    expect(await getDiscordAccountIdForPrincipal(author)).toBeNull()
  })
})

describe('resolveAuthorDiscordIdForActor (team-only gate)', () => {
  beforeEach(() => {
    hoisted.rows = [{ accountId: '333' }]
  })

  it.each([
    ['anonymous', actor(null, 'anonymous')],
    ['regular user', actor('user')],
    ['no role', actor(null)],
  ])('never returns the id to a %s and does not query', async (_name, a) => {
    expect(await resolveAuthorDiscordIdForActor(a, author)).toBeNull()
    expect(hoisted.select).not.toHaveBeenCalled()
  })

  it.each([['admin'], ['member']] as const)('returns the id to a team %s', async (role) => {
    expect(await resolveAuthorDiscordIdForActor(actor(role), author)).toBe('333')
  })

  it('returns null for a team viewer when the post has no author principal', async () => {
    expect(await resolveAuthorDiscordIdForActor(actor('admin'), null)).toBeNull()
    expect(hoisted.select).not.toHaveBeenCalled()
  })
})
