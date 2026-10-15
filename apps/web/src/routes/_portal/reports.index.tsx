import { createFileRoute, Link, notFound, useRouteContext } from '@tanstack/react-router'
import { useQueryClient, useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { z } from 'zod'
import {
  ChatBubbleLeftIcon,
  EyeIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { FeedbackHeader } from '@/components/public/feedback/feedback-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { TimeAgo } from '@/components/ui/time-ago'
import { portalQueries } from '@/lib/client/queries/portal'
import { reportsQueries } from '@/lib/client/queries/reports'
import { isProductEnabled } from '@/lib/shared/types/settings'
import { cn, getInitials } from '@/lib/shared/utils'
import {
  ReportRulesCard,
  ReportRulesCollapsible,
  collectReportRules,
} from '@/components/public/reports/report-rules'
import { ReportNotice } from '@/components/public/reports/report-notice'
import {
  PrivateReportBadge,
  ReportTypePicker,
} from '@/components/public/reports/report-type-picker'
import type { ReportListItem } from '@/lib/server/functions/reports'

const searchSchema = z.object({
  status: z.string().max(100).optional().catch(undefined),
  /** The report type being filed: a report board's slug (opens its composer). */
  type: z.string().max(200).optional().catch(undefined),
  /** List filter: show only reports of this type (a report board's slug). */
  board: z.string().max(200).optional().catch(undefined),
})

export const Route = createFileRoute('/_portal/reports/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ status: search.status, board: search.board }),
  loader: async ({ context, deps }) => {
    const { queryClient, settings, baseUrl } = context
    // Reports are posts, so they live and die with the feedback product.
    if (!isProductEnabled(settings?.featureFlags, 'feedback')) throw notFound()

    const [page] = await Promise.all([
      queryClient.ensureQueryData(reportsQueries.page({})),
      queryClient.ensureInfiniteQueryData(
        reportsQueries.list({ status: deps.status, boardSlug: deps.board })
      ),
      queryClient.ensureQueryData(portalQueries.statuses()),
    ])
    // No report board visible to this viewer: there is nothing to show here.
    if (page.boards.length === 0) throw notFound()

    return {
      workspaceName: settings?.name ?? 'Quackback',
      baseUrl: baseUrl ?? '',
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const { workspaceName, baseUrl } = loaderData
    const title = `Reports - ${workspaceName}`
    const description = `Public reports to the ${workspaceName} moderation team and how each one was handled.`
    const canonicalUrl = baseUrl ? `${baseUrl}/reports` : ''
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        ...(canonicalUrl ? [{ property: 'og:url', content: canonicalUrl }] : []),
      ],
      links: canonicalUrl ? [{ rel: 'canonical', href: canonicalUrl }] : [],
    }
  },
  component: ReportsPage,
})

function ReportsPage() {
  const { workspaceName } = Route.useLoaderData()
  const { status, type, board: boardFilter } = Route.useSearch()
  const { session } = useRouteContext({ from: '__root__' })
  const queryClient = useQueryClient()

  const { data: page } = useSuspenseQuery(reportsQueries.page({}))
  const { data: statuses } = useSuspenseQuery(portalQueries.statuses())

  const user = session?.user ? { name: session.user.name, email: session.user.email } : null

  // Step 1 offers the types the viewer can file to. When none admit them (a
  // signed-out or anonymous-session visitor), every type is still offered so the
  // composer can ask them to sign in instead of the page going silent. A lone
  // type needs no picking.
  const fileable = page.boards.filter((b) => page.boardPermissions[b.id]?.canSubmit)
  const pickable = fileable.length > 0 ? fileable : page.boards
  const chosen =
    pickable.find((b) => b.slug === type) ?? (pickable.length === 1 ? pickable[0] : undefined)
  const hasPrivateType = page.boards.some((b) => b.isPrivate)
  // The rules sidebar follows the chosen type, and groups every type's rules
  // while none is chosen.
  const rules = collectReportRules(chosen ? [chosen] : page.boards)
  const changeTypeSearch = {
    ...(status ? { status } : {}),
    ...(boardFilter ? { board: boardFilter } : {}),
  }

  return (
    <div
      className={cn(
        'mx-auto w-full px-4 sm:px-6 py-8',
        rules.length > 0 ? 'max-w-6xl' : 'max-w-3xl'
      )}
    >
      <div
        className={cn(
          rules.length > 0 && 'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8'
        )}
      >
        <div className="min-w-0">
          <div className="mb-6 animate-in fade-in duration-200 fill-mode-backwards">
            <h1 className="text-3xl font-bold mb-2">
              <FormattedMessage id="portal.reports.title" defaultMessage="Reports" />
            </h1>
            <p className="text-muted-foreground">
              <FormattedMessage
                id="portal.reports.subtitle"
                defaultMessage="Report a problem to the moderation team and talk it through with them."
              />
            </p>
            {(chosen ? !chosen.isPrivate : !hasPrivateType) && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <EyeIcon className="mt-0.5 size-4 shrink-0" />
                <FormattedMessage
                  id="portal.reports.transparencyNote"
                  defaultMessage="Every report and the team's replies are public, so the whole community can see how each one was handled. Only the reporter and the team can reply."
                />
              </p>
            )}
            {/* The composer carries its own copy of the notice once a type is chosen. */}
            {!chosen && <ReportNotice markdown={page.reportNotice} className="mt-3" />}
          </div>

          {/* Small screens: the rules sit above the composer, folded away. */}
          {!chosen && <ReportRulesCollapsible sections={rules} className="mb-6 lg:hidden" />}

          {chosen ? (
            <FeedbackHeader
              key={chosen.id}
              variant="report"
              workspaceName={workspaceName}
              boards={[chosen]}
              defaultBoardId={chosen.id}
              boardLocked
              user={user}
              boardPermissions={page.boardPermissions}
              reportGuide={{
                boardId: chosen.id,
                boardName: chosen.name,
                isPrivate: chosen.isPrivate,
                notice: page.reportNotice,
                rules: chosen.settings?.rulesMarkdown ?? '',
                canChangeType: pickable.length > 1,
                changeTypeSearch,
              }}
              onPostCreated={() => {
                void queryClient.invalidateQueries({ queryKey: ['portal', 'reports'] })
              }}
            />
          ) : (
            <ReportTypePicker types={pickable} status={status} boardFilter={boardFilter} />
          )}

          <ReportFilters
            statuses={statuses}
            boards={page.boards}
            status={status}
            board={boardFilter}
            type={chosen?.slug}
          />

          <ReportList status={status} board={boardFilter} statuses={statuses} showType />
        </div>

        {rules.length > 0 && (
          <div className="hidden lg:block">
            <ReportRulesCard sections={rules} sticky />
          </div>
        )}
      </div>
    </div>
  )
}

interface StatusOption {
  id: string
  name: string
  slug: string
  color: string
}

interface FilterState {
  status?: string
  board?: string
  type?: string
}

function ReportFilters({
  statuses,
  boards,
  status,
  board,
  type,
}: {
  statuses: StatusOption[]
  boards: Array<{ id: string; name: string; slug: string; isPrivate: boolean }>
  status?: string
  board?: string
  type?: string
}) {
  // Every chip keeps the other filter and the type being filed.
  const next = (patch: Partial<FilterState>): FilterState => {
    const merged = { status, board, type, ...patch }
    return {
      ...(merged.status ? { status: merged.status } : {}),
      ...(merged.board ? { board: merged.board } : {}),
      ...(merged.type ? { type: merged.type } : {}),
    }
  }
  return (
    <div className="mb-4 space-y-2">
      {boards.length > 1 && (
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Filter reports by type">
          <FilterChip search={next({ board: undefined })} active={!board}>
            <FormattedMessage id="portal.reports.filterAll" defaultMessage="All" />
          </FilterChip>
          {boards.map((b) => (
            <FilterChip key={b.id} search={next({ board: b.slug })} active={board === b.slug}>
              {b.isPrivate && <LockClosedIcon className="size-3" aria-hidden />}
              {b.name}
            </FilterChip>
          ))}
        </nav>
      )}
      <nav className="flex flex-wrap items-center gap-1.5" aria-label="Filter reports by status">
        <FilterChip search={next({ status: undefined })} active={!status}>
          <FormattedMessage id="portal.reports.filterAll" defaultMessage="All" />
        </FilterChip>
        {statuses.map((s) => (
          <FilterChip key={s.id} search={next({ status: s.slug })} active={status === s.slug}>
            <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </FilterChip>
        ))}
      </nav>
    </div>
  )
}

function FilterChip({
  search,
  active,
  children,
}: {
  search: FilterState
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      asChild
      size="sm"
      variant={active ? 'secondary' : 'outline'}
      className={cn('rounded-full', !active && 'text-muted-foreground')}
    >
      <Link to="/reports" search={search} aria-current={active ? 'page' : undefined}>
        {children}
      </Link>
    </Button>
  )
}

function ReportList({
  status,
  board,
  statuses,
  showType,
}: {
  status?: string
  board?: string
  statuses: StatusOption[]
  showType: boolean
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    reportsQueries.list({ status, boardSlug: board })
  )
  const reports = data.pages.flatMap((p) => p.reports.items)
  const statusById = new Map(statuses.map((s) => [s.id, s]))

  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        <ShieldCheckIcon className="mx-auto mb-2 size-6" />
        {status || board ? (
          <FormattedMessage
            id="portal.reports.emptyFiltered"
            defaultMessage="No reports with this status."
          />
        ) : (
          <FormattedMessage id="portal.reports.empty" defaultMessage="No reports yet." />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {reports.map((report) => (
          <ReportRow
            key={report.id}
            report={report}
            status={report.statusId ? statusById.get(report.statusId) : undefined}
            showType={showType}
          />
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            <FormattedMessage id="portal.reports.loadMore" defaultMessage="Load more" />
          </Button>
        </div>
      )}
    </div>
  )
}

function ReportRow({
  report,
  status,
  showType,
}: {
  report: ReportListItem
  status?: StatusOption
  showType: boolean
}) {
  const intl = useIntl()
  const author =
    report.authorName ??
    intl.formatMessage({ id: 'portal.reports.anonymous', defaultMessage: 'Anonymous' })

  return (
    <li>
      <Link
        to="/b/$slug/posts/$postId"
        params={{ slug: report.board.slug, postId: report.id }}
        className="block px-4 py-3.5 transition-colors hover:bg-muted/40"
      >
        {(status || showType || report.isPrivate) && (
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            {status && <StatusBadge name={status.name} color={status.color} />}
            {showType && (
              <span
                data-testid="report-type"
                className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {report.board.name}
              </span>
            )}
            {report.isPrivate && <PrivateReportBadge />}
          </div>
        )}
        <div className="font-semibold text-foreground line-clamp-2">{report.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Avatar className="size-5">
              {report.avatarUrl && <AvatarImage src={report.avatarUrl} alt="" />}
              <AvatarFallback className="text-[11px]">{getInitials(author)}</AvatarFallback>
            </Avatar>
            <span className="text-foreground/80">{author}</span>
          </span>
          <span aria-hidden>·</span>
          <TimeAgo date={report.createdAt} />
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <ChatBubbleLeftIcon className="size-3.5" />
            <FormattedMessage
              id="portal.reports.replies"
              defaultMessage="{count, plural, one {# reply} other {# replies}}"
              values={{ count: report.commentCount }}
            />
          </span>
        </div>
      </Link>
    </li>
  )
}
