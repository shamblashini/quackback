/**
 * Tests for Discord message building — changelog announcements.
 */

import { describe, it, expect } from 'vitest'
import { buildDiscordMessage } from '../message'
import type { EventData } from '@/lib/server/events/types'

const ROOT_URL = 'https://feedback.example.com'
const ENTRY_URL = `${ROOT_URL}/changelog/changelog_123`

function changelogPublishedEvent(overrides: Record<string, unknown> = {}): EventData {
  return {
    id: 'evt_1',
    timestamp: '2026-07-21T12:00:00.000Z',
    actor: { type: 'user', id: 'principal_1', name: 'Test User' },
    type: 'changelog.published',
    data: {
      changelog: {
        id: 'changelog_123',
        title: 'Dark mode is here',
        contentPreview: '## Dark mode\n\nSwitch the **portal** to a dark theme from your profile.',
        contentHtml: '<h2>Dark mode</h2><p>Switch the portal to a dark theme.</p>',
        publishedAt: '2026-07-21T12:00:00.000Z',
        linkedPostCount: 0,
        featuredImageUrl: null,
        ...overrides,
      },
    },
  } as EventData
}

describe('buildDiscordMessage — changelog.published', () => {
  it('links the title to the entry itself', () => {
    const embed = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL).embeds?.[0]

    expect(embed).toMatchObject({ title: 'Dark mode is here', url: ENTRY_URL })
  })

  it('shows a Changelog header and no body, footer or time', () => {
    const embed = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL).embeds?.[0]

    expect(embed?.author).toEqual({ name: 'Changelog 📢' })
    expect(embed).not.toHaveProperty('description')
    expect(embed).not.toHaveProperty('footer')
    expect(embed).not.toHaveProperty('timestamp')
  })

  it('puts the read link in a button below the embed', () => {
    const message = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL)

    expect(message.components).toEqual([
      {
        type: 1,
        components: [{ type: 2, style: 5, label: 'Read the full update', url: ENTRY_URL }],
      },
    ])
  })

  it('uses the warm orange accent', () => {
    const embed = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL).embeds?.[0]

    expect(embed?.color).toBe(0xe7a33d)
  })

  it('shows the featured image when the entry has one', () => {
    const embed = buildDiscordMessage(
      changelogPublishedEvent({ featuredImageUrl: 'https://cdn.example.com/cover.png' }),
      ROOT_URL
    ).embeds?.[0]

    expect(embed?.image).toEqual({ url: 'https://cdn.example.com/cover.png' })
  })

  it('leaves the image out when the entry has none', () => {
    const embed = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL).embeds?.[0]

    expect(embed).not.toHaveProperty('image')
  })

  it('still builds a message for events queued before featuredImageUrl existed', () => {
    const event = changelogPublishedEvent()
    delete (event.data as { changelog: Record<string, unknown> }).changelog.featuredImageUrl

    expect(buildDiscordMessage(event, ROOT_URL).embeds?.[0]).not.toHaveProperty('image')
  })

  it('never lets the entry ping @everyone, roles or users', () => {
    const message = buildDiscordMessage(
      changelogPublishedEvent({ contentPreview: '@everyone new release' }),
      ROOT_URL
    )

    expect(message.allowed_mentions).toEqual({ parse: [] })
  })
})

describe('buildDiscordMessage — post.created', () => {
  const event = {
    id: 'evt_2',
    timestamp: '2026-07-21T12:00:00.000Z',
    actor: { type: 'user', id: 'principal_1', name: 'Test User' },
    type: 'post.created',
    data: {
      post: {
        id: 'post_123',
        title: 'Add dark mode',
        content: 'A long body that belongs on the portal, not in the channel',
        boardId: 'board_1',
        boardSlug: 'features',
        authorName: 'Ada',
        voteCount: 0,
      },
    },
  } as unknown as EventData

  it('posts the title and a link to read the post, without the body', () => {
    const embed = buildDiscordMessage(event, ROOT_URL).embeds?.[0]
    const postUrl = `${ROOT_URL}/b/features/posts/post_123`

    expect(embed).toMatchObject({ title: 'Add dark mode', url: postUrl })
    expect(embed?.description).toBe(`**[Read the post →](${postUrl})**`)
    expect(JSON.stringify(embed)).not.toContain('long body')
  })
})
