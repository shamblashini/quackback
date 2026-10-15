/**
 * Chat and tracker integrations never receive events about posts on a private
 * report board (kind reports, view team); public report boards and ordinary
 * boards are unaffected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  boardRows: [] as Array<{ access: unknown }>,
}))

vi.mock('@/lib/server/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => mocks.boardRows }) }),
  },
  boards: { id: 'id', access: 'access' },
  integrations: {},
  integrationEventMappings: {},
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}))

vi.mock('@/lib/server/cache', () => ({
  cacheGet: async () => [
    {
      eventType: 'post.created',
      integrationType: 'discord',
      integrationId: 'integration_1',
      integrationConfig: { channelId: 'chan' },
      actionConfig: {},
      filters: null,
    },
  ],
  cacheSet: vi.fn(),
  CACHE_KEYS: { INTEGRATION_MAPPINGS: 'k' },
}))

import { integrationResolver } from '../integration.resolver'
import type { DomainEvent } from '../../envelope'

const event = {
  type: 'post.created',
  payload: { post: { id: 'post_1', boardId: 'board_1' } },
} as unknown as DomainEvent

const access = (over: Record<string, unknown>) => ({ view: 'anonymous', ...over })

describe('integration resolver and private report boards', () => {
  beforeEach(() => {
    mocks.boardRows = []
  })

  it('skips a post on a private report board', async () => {
    mocks.boardRows = [{ access: access({ kind: 'reports', view: 'team' }) }]
    expect(await integrationResolver.resolve(event)).toEqual([])
  })

  it('still delivers a post on a public report board', async () => {
    mocks.boardRows = [{ access: access({ kind: 'reports' }) }]
    expect(await integrationResolver.resolve(event)).toHaveLength(1)
  })

  it('still delivers a post on an ordinary board', async () => {
    mocks.boardRows = [{ access: access({}) }]
    expect(await integrationResolver.resolve(event)).toHaveLength(1)
  })
})
