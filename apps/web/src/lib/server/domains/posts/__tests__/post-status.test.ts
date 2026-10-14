import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PostId, PostStatusId, PrincipalId } from '@quackback/ids'

const createActivity = vi.fn()
const dispatchPostStatusChanged = vi.fn()
const mockPostsFindFirst = vi.fn()
const mockBoardsFindFirst = vi.fn()
const mockStatusesFindFirst = vi.fn()

const updateReturning = vi.fn()
const updateWhere = vi.fn(() => ({ returning: updateReturning }))
const updateSet = vi.fn(() => ({ where: updateWhere }))
const dbUpdate = vi.fn(() => ({ set: updateSet }))

vi.mock('@/lib/server/db', () => ({
  db: {
    query: {
      posts: { findFirst: (...args: unknown[]) => mockPostsFindFirst(...args) },
      boards: { findFirst: (...args: unknown[]) => mockBoardsFindFirst(...args) },
      postStatuses: { findFirst: (...args: unknown[]) => mockStatusesFindFirst(...args) },
    },
    update: dbUpdate,
  },
  boards: { id: 'board_id' },
  posts: { id: 'post_id' },
  postStatuses: { id: 'status_id' },
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
}))

vi.mock('@/lib/server/domains/activity/activity.service', () => ({ createActivity }))
vi.mock('@/lib/server/events/dispatch', () => ({
  dispatchPostStatusChanged,
  buildEventActor: vi.fn((actor: unknown) => actor),
}))

const actor = { principalId: 'principal_abc' as PrincipalId }
const OPEN = { id: 'status_open', name: 'Open', slug: 'open', color: '#888' }
const DONE = { id: 'status_done', name: 'Done', slug: 'done', color: '#0a0' }

describe('changeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBoardsFindFirst.mockResolvedValue({ id: 'board_1', slug: 'ideas' })
  })

  it('is a no-op when the post already has that status', async () => {
    mockPostsFindFirst.mockResolvedValue({
      id: 'post_1',
      title: 'A post',
      boardId: 'board_1',
      statusId: 'status_open',
    })
    mockStatusesFindFirst.mockResolvedValue(OPEN)
    const { changeStatus } = await import('../post.status')

    const result = await changeStatus('post_1' as PostId, 'status_open' as PostStatusId, actor)

    expect(dbUpdate).not.toHaveBeenCalled()
    expect(dispatchPostStatusChanged).not.toHaveBeenCalled()
    expect(createActivity).not.toHaveBeenCalled()
    expect(result.previousStatus).toBe('Open')
    expect(result.newStatus).toBe('Open')
    expect(result.boardSlug).toBe('ideas')
  })

  it('updates, dispatches and records activity when the status differs', async () => {
    mockPostsFindFirst.mockResolvedValue({
      id: 'post_1',
      title: 'A post',
      boardId: 'board_1',
      statusId: 'status_open',
    })
    // Promise.all order: [new status, previous status]
    mockStatusesFindFirst.mockResolvedValueOnce(DONE).mockResolvedValueOnce(OPEN)
    updateReturning.mockResolvedValue([
      { id: 'post_1', title: 'A post', boardId: 'board_1', statusId: 'status_done' },
    ])
    const { changeStatus } = await import('../post.status')

    const result = await changeStatus('post_1' as PostId, 'status_done' as PostStatusId, actor)

    expect(dbUpdate).toHaveBeenCalled()
    expect(dispatchPostStatusChanged).toHaveBeenCalledTimes(1)
    expect(createActivity).toHaveBeenCalledWith(expect.objectContaining({ type: 'status.changed' }))
    expect(result.previousStatus).toBe('Open')
    expect(result.newStatus).toBe('Done')
  })
})
