/**
 * Portal reports page — the public face of report boards.
 *
 * A report board (`access.kind === 'reports'`) is a feedback board turned into
 * a transparent report log: anyone the board admits can read every report and
 * its reporter <-> team thread, which is why the list keeps every status
 * (resolved and closed reports included) rather than hiding finished ones the
 * way the feedback feed does. Reports are ordinary posts, so detail pages,
 * comments, notifications and moderation all reuse the post machinery.
 *
 * The same outer gates as fetchPortalData apply: a private portal serves
 * nothing to a caller the portal-access resolver denies, and the per-board
 * audience filter is the inner layer for granted callers.
 */
import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import type { BoardSettings } from '@/lib/server/db'
import { getOptionalAuth, policyActorFromAuth } from './auth-helpers'
import { resolvePortalAccessForRequest } from './portal-access'
import { runBuildBoardPermissions, runLoadAllowAnonymous } from './portal'
import { listPublicBoardsWithStats } from '@/lib/server/domains/boards/board.public'
import { listPublicPostsWithVotesAndAvatars } from '@/lib/server/domains/posts/post.public'
import { logger } from '@/lib/server/logger'

const log = logger.child({ component: 'reports' })

export const REPORTS_PAGE_SIZE = 20

const fetchReportsSchema = z.object({
  status: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).max(1000).optional(),
})

export type FetchReportsInput = z.infer<typeof fetchReportsSchema>

export interface ReportListItem {
  id: string
  title: string
  statusId: string | null
  commentCount: number
  authorName: string | null
  avatarUrl: string | null
  createdAt: string
  board: { id: string; name: string; slug: string }
}

export interface ReportsPageData {
  boards: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    settings: BoardSettings
  }>
  boardPermissions: Record<string, { canSubmit: boolean; canVote: boolean }>
  reports: { items: ReportListItem[]; hasMore: boolean }
}

const EMPTY: ReportsPageData = {
  boards: [],
  boardPermissions: {},
  reports: { items: [], hasMore: false },
}

export const fetchReportsPageFn = createServerFn({ method: 'GET' })
  .validator(fetchReportsSchema)
  .handler(async ({ data }): Promise<ReportsPageData> => {
    log.debug({ status: data.status, page: data.page }, 'fetch reports page')

    const access = await resolvePortalAccessForRequest()
    if (!access.granted) return EMPTY

    const auth = await getOptionalAuth()
    const actor = await policyActorFromAuth(auth)

    const [boardsRaw, postsResult, allowAnonymous] = await Promise.all([
      listPublicBoardsWithStats(actor, 'reports'),
      listPublicPostsWithVotesAndAvatars({
        actor,
        boardKind: 'reports',
        allStatuses: true,
        statusSlugs: data.status ? [data.status] : undefined,
        search: data.search || undefined,
        sort: 'new',
        page: data.page ?? 1,
        limit: REPORTS_PAGE_SIZE,
      }),
      runLoadAllowAnonymous(),
    ])

    if (boardsRaw.length === 0) return EMPTY

    const boardPermissions = await runBuildBoardPermissions(actor, boardsRaw, allowAnonymous)

    return {
      // The access matrix stays server-side, as on fetchPortalData (#191).
      boards: boardsRaw.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        description: b.description,
        settings: (b.settings ?? {}) as BoardSettings,
      })),
      boardPermissions,
      reports: {
        items: postsResult.items.map((post) => ({
          id: post.id,
          title: post.title,
          statusId: post.statusId,
          commentCount: post.commentCount,
          authorName: post.authorName,
          avatarUrl: post.avatarUrl,
          createdAt: post.createdAt.toISOString(),
          board: post.board,
        })),
        hasMore: postsResult.hasMore,
      },
    }
  })

/**
 * Whether the viewer can see at least one report board — gates the portal's
 * Reports nav tab. Kept separate from the page fetch so the header can ask
 * cheaply on every portal page.
 */
export const fetchHasReportBoardsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => {
    const access = await resolvePortalAccessForRequest()
    if (!access.granted) return false
    const auth = await getOptionalAuth()
    const actor = await policyActorFromAuth(auth)
    const boards = await listPublicBoardsWithStats(actor, 'reports')
    return boards.length > 0
  }
)
