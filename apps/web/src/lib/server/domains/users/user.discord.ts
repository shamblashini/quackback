/**
 * Discord account lookups for moderation.
 *
 * After a Discord sign-in the better-auth `account` row carries
 * `providerId = 'discord'` and `accountId` = the Discord user snowflake.
 * Moderators use it to match a post author to their Discord account.
 *
 * SECURITY: the Discord id is team-only. Callers on a portal-facing path must
 * go through {@link resolveAuthorDiscordIdForActor}, which refuses non-team
 * actors before touching the database.
 */

import { db, and, eq, inArray, account, principal } from '@/lib/server/db'
import { isTeamActor, type Actor } from '@/lib/server/policy'
import type { PrincipalId, UserId } from '@quackback/ids'

const DISCORD_PROVIDER_ID = 'discord'

/** Discord user ids for a set of users, in one query. Users without one are absent. */
export async function getDiscordAccountIds(userIds: UserId[]): Promise<Map<UserId, string>> {
  const result = new Map<UserId, string>()
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return result

  const rows = await db
    .select({ userId: account.userId, accountId: account.accountId })
    .from(account)
    .where(and(inArray(account.userId, unique), eq(account.providerId, DISCORD_PROVIDER_ID)))

  for (const row of rows) {
    // A user could in theory hold two discord rows; keep the first.
    if (!result.has(row.userId as UserId)) result.set(row.userId as UserId, row.accountId)
  }
  return result
}

/** Discord user id for one user, or null when no Discord account is linked. */
export async function getDiscordAccountId(userId: UserId): Promise<string | null> {
  return (await getDiscordAccountIds([userId])).get(userId) ?? null
}

/** Discord user id for the user behind a principal, or null. */
export async function getDiscordAccountIdForPrincipal(
  principalId: PrincipalId
): Promise<string | null> {
  const rows = await db
    .select({ accountId: account.accountId })
    .from(principal)
    .innerJoin(account, eq(account.userId, principal.userId))
    .where(and(eq(principal.id, principalId), eq(account.providerId, DISCORD_PROVIDER_ID)))
    .limit(1)
  return rows[0]?.accountId ?? null
}

/**
 * Team-only gate for portal-facing reads: returns the author's Discord id only
 * when the viewer is a team member. Non-team actors (anonymous or regular
 * users) get null without any database access.
 */
export async function resolveAuthorDiscordIdForActor(
  actor: Actor,
  authorPrincipalId: PrincipalId | null
): Promise<string | null> {
  if (!isTeamActor(actor) || !authorPrincipalId) return null
  return getDiscordAccountIdForPrincipal(authorPrincipalId)
}
