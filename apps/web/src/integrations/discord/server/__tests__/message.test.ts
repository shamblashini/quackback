/**
 * Tests for Discord message building — changelog announcements.
 */

import { describe, it, expect } from 'vitest'
import { buildDiscordMessage } from '../message'
import type { EventData } from '@/lib/server/events/types'

const ROOT_URL = 'https://feedback.example.com'

function changelogPublishedEvent(title = 'Dark mode is here'): EventData {
  return {
    id: 'evt_1',
    timestamp: '2026-07-21T12:00:00.000Z',
    actor: { type: 'user', email: 'admin@example.com' },
    type: 'changelog.published',
    data: {
      changelog: {
        id: 'changelog_123',
        title,
        contentPreview: 'A long description that should not be posted',
        contentHtml: '<p>A long description that should not be posted</p>',
        publishedAt: '2026-07-21T12:00:00.000Z',
        linkedPostCount: 0,
      },
    },
  } as EventData
}

describe('buildDiscordMessage — changelog.published', () => {
  it('posts the title and a link to the public changelog entry', () => {
    const message = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL)

    const entryUrl = `${ROOT_URL}/changelog/changelog_123`
    expect(message.content).toContain('Dark mode is here')
    expect(message.content).toContain(entryUrl)
    expect(message.embeds?.[0]).toMatchObject({ title: 'Dark mode is here', url: entryUrl })
  })

  it('leaves the entry body out of the announcement', () => {
    const message = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL)

    expect(JSON.stringify(message)).not.toContain('long description')
  })
})
