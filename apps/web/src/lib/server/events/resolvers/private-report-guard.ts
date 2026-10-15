import { db, boards, inArray } from '@/lib/server/db'
import { isPrivateReportAccess } from '@/lib/shared/report-privacy'
import { boardIdsFromEvent } from './webhook.resolver'
import type { DomainEvent } from '../envelope'

/**
 * Whether the event is about a post on a private report board (kind reports,
 * view team). Chat and tracker integrations post into channels whose audience
 * this system cannot see, so a private report never leaves through them: the
 * reporter and the team are the only readers, and the portal and the admin
 * inbox are where the team reads it. (Webhooks are team-configured endpoints and
 * are left alone.)
 */
export async function touchesPrivateReportBoard(event: DomainEvent): Promise<boolean> {
  const boardIds = boardIdsFromEvent(event)
  if (boardIds.length === 0) return false
  const rows = await db
    .select({ access: boards.access })
    .from(boards)
    .where(inArray(boards.id, boardIds as never[]))
  return rows.some((row) => isPrivateReportAccess(row.access))
}
