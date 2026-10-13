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

  it('shows a plain-text excerpt and a read-more link to the entry', () => {
    const description = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL).embeds?.[0]
      ?.description

    expect(description).toMatch(/^Switch the portal to a dark theme from your profile\./)
    expect(description).not.toContain('**portal**')
    expect(description).toContain(`[Read the full update →](${ENTRY_URL})`)
  })

  it('leaves headings out of the excerpt', () => {
    const description = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL).embeds?.[0]
      ?.description

    expect(description).not.toContain('Dark mode')
    expect(description).not.toContain('#')
  })

  it('caps the excerpt at 200 characters', () => {
    const long = 'word '.repeat(100)
    const description = buildDiscordMessage(
      changelogPublishedEvent({ contentPreview: long }),
      ROOT_URL
    ).embeds?.[0]?.description
    const excerpt = description?.split('\n\n')[0] ?? ''

    expect(excerpt.length).toBeLessThanOrEqual(203)
    expect(excerpt.endsWith('...')).toBe(true)
  })

  it('posts only the read-more link when the entry has no text', () => {
    const description = buildDiscordMessage(
      changelogPublishedEvent({ contentPreview: '' }),
      ROOT_URL
    ).embeds?.[0]?.description

    expect(description).toBe(`**[Read the full update →](${ENTRY_URL})**`)
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

  it('names the portal in the footer', () => {
    const embed = buildDiscordMessage(changelogPublishedEvent(), ROOT_URL).embeds?.[0]

    expect(embed?.footer).toEqual({ text: 'feedback.example.com changelog' })
  })

  it('never lets the entry ping @everyone, roles or users', () => {
    const message = buildDiscordMessage(
      changelogPublishedEvent({ contentPreview: '@everyone new release' }),
      ROOT_URL
    )

    expect(message.allowed_mentions).toEqual({ parse: [] })
  })
})
