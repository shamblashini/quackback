/**
 * Report posts must not surface through changelogs: neither in the admin
 * linked-posts picker (searchShippedPosts) nor in the linked posts the public
 * changelog renders. The predicates run in SQL, so these tests capture the
 * WHERE argument and look for the feedback-only board kind fragment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChangelogId } from '@quackback/ids'
import { getPublicChangelogById, listPublicChangelogs } from '../changelog.public'
import { searchShippedPosts } from '../changelog.query'

const mockEntryFindFirst = vi.fn()
const mockEntryFindMany = vi.fn()
const mockStatusesFindMany = vi.fn()
const mockSelect = vi.fn()
const whereArgs: unknown[] = []

vi.mock('@/lib/server/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/db')>()),
  db: {
    query: {
      changelogEntries: {
        findFirst: (...args: unknown[]) => mockEntryFindFirst(...args),
        findMany: (...args: unknown[]) => mockEntryFindMany(...args),
      },
      postStatuses: { findMany: (...args: unknown[]) => mockStatusesFindMany(...args) },
      changelogEntryCategories: { findMany: vi.fn().mockResolvedValue([]) },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    update: () => ({ set: () => ({ where: () => ({ catch: () => {} }) }) }),
  },
  and: vi.fn((...args: unknown[]) => ({ kind: 'and', args })),
}))

/** True when any nested SQL fragment carries the feedback-only board kind text. */
function hasFeedbackKindFilter(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const node = value as { args?: unknown[]; queryChunks?: unknown[]; value?: unknown }
  if (Array.isArray(node.value) && node.value.join('').includes("<> 'reports'")) return true
  return [...(node.args ?? []), ...(node.queryChunks ?? [])].some(hasFeedbackKindFilter)
}

function selectCapturingWhere(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.innerJoin = () => chain
  chain.orderBy = () => chain
  chain.limit = () => Promise.resolve(rows)
  chain.where = (arg: unknown) => {
    whereArgs.push(arg)
    return Object.assign(Promise.resolve(rows), chain)
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  whereArgs.length = 0
  mockStatusesFindMany.mockResolvedValue([])
})

describe('searchShippedPosts', () => {
  it('only offers posts from feedback boards', async () => {
    mockStatusesFindMany.mockResolvedValue([{ id: 'status_done' }])
    mockSelect.mockReturnValueOnce(selectCapturingWhere([]))

    await searchShippedPosts({ query: 'crash' })

    expect(whereArgs).toHaveLength(1)
    expect(hasFeedbackKindFilter(whereArgs[0])).toBe(true)
  })
})

describe('public changelog linked posts', () => {
  it('getPublicChangelogById excludes report posts from the linked posts query', async () => {
    mockEntryFindFirst.mockResolvedValueOnce({
      id: 'cl_1' as ChangelogId,
      title: 'Release',
      content: '',
      contentJson: null,
      publishedAt: new Date('2026-01-01'),
    })
    mockSelect.mockReturnValueOnce(selectCapturingWhere([]))

    await getPublicChangelogById('cl_1' as ChangelogId)

    expect(whereArgs).toHaveLength(1)
    expect(hasFeedbackKindFilter(whereArgs[0])).toBe(true)
  })

  it('listPublicChangelogs excludes report posts from the linked posts query', async () => {
    const entry = {
      id: 'cl_1' as ChangelogId,
      title: 'Release',
      content: '',
      contentJson: null,
      publishedAt: new Date('2026-01-01'),
      displayDate: null,
    }
    // First select: the entries page; second: the linked posts.
    mockSelect
      .mockReturnValueOnce(selectCapturingWhere([entry]))
      .mockReturnValueOnce(selectCapturingWhere([]))

    await listPublicChangelogs({})

    const linkedWhere = whereArgs[whereArgs.length - 1]
    expect(hasFeedbackKindFilter(linkedWhere)).toBe(true)
  })
})
