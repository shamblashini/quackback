import { createFileRoute, Link, notFound, useRouteContext } from '@tanstack/react-router'
import { useQueryClient, useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query'
import { FormattedMessage, useIntl } from 'react-intl'
import { z } from 'zod'
import { ChatBubbleLeftIcon, EyeIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { FeedbackHeader } from '@/components/public/feedback/feedback-header'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { TimeAgo } from '@/components/ui/time-ago'
import { portalQueries } from '@/lib/client/queries/portal'
import { reportsQueries } from '@/lib/client/queries/reports'
import { isProductEnabled } from '@/lib/shared/types/settings'
import { cn, getInitials } from '@/lib/shared/utils'
import type { ReportListItem } from '@/lib/server/functions/reports'

const searchSchema = z.object({
  status: z.string().max(100).optional().catch(undefined),
})

export const Route = createFileRoute('/_portal/reports/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: async ({ context, deps }) => {
    const { queryClient, settings, baseUrl } = context
    // Reports are posts, so they live and die with the feedback product.
    if (!isProductEnabled(settings?.featureFlags, 'feedback')) throw notFound()

    const [page] = await Promise.all([
      queryClient.ensureQueryData(reportsQueries.page({})),
      queryClient.ensureInfiniteQueryData(reportsQueries.list({ status: deps.status })),
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
  const { status } = Route.useSearch()
  const { session } = useRouteContext({ from: '__root__' })
  const queryClient = useQueryClient()

  const { data: page } = useSuspenseQuery(reportsQueries.page({}))
  const { data: statuses } = useSuspenseQuery(portalQueries.statuses())

  const user = session?.user ? { name: session.user.name, email: session.user.email } : null

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-8">
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
        <p className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <EyeIcon className="mt-0.5 size-4 shrink-0" />
          <FormattedMessage
            id="portal.reports.transparencyNote"
            defaultMessage="Every report and the team's replies are public, so the whole community can see how each one was handled. Only the reporter and the team can reply."
          />
        </p>
      </div>

      <FeedbackHeader
        variant="report"
        workspaceName={workspaceName}
        boards={page.boards}
        defaultBoardId={page.boards.length === 1 ? page.boards[0].id : undefined}
        user={user}
        boardPermissions={page.boardPermissions}
        onPostCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ['portal', 'reports'] })
        }}
      />

      <StatusFilter statuses={statuses} active={status} />

      <ReportList status={status} statuses={statuses} />
    </div>
  )
}

interface StatusOption {
  id: string
  name: string
  slug: string
  color: string
}

function StatusFilter({ statuses, active }: { statuses: StatusOption[]; active?: string }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5" aria-label="Filter reports by status">
      <FilterChip to={undefined} active={!active}>
        <FormattedMessage id="portal.reports.filterAll" defaultMessage="All" />
      </FilterChip>
      {statuses.map((s) => (
        <FilterChip key={s.id} to={s.slug} active={active === s.slug}>
          <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
          {s.name}
        </FilterChip>
      ))}
    </nav>
  )
}

function FilterChip({
  to,
  active,
  children,
}: {
  to: string | undefined
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
      <Link
        to="/reports"
        search={to ? { status: to } : {}}
        aria-current={active ? 'page' : undefined}
      >
        {children}
      </Link>
    </Button>
  )
}

function ReportList({ status, statuses }: { status?: string; statuses: StatusOption[] }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery(
    reportsQueries.list({ status })
  )
  const reports = data.pages.flatMap((p) => p.reports.items)
  const statusById = new Map(statuses.map((s) => [s.id, s]))

  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
        <ShieldCheckIcon className="mx-auto mb-2 size-6" />
        {status ? (
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

function ReportRow({ report, status }: { report: ReportListItem; status?: StatusOption }) {
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
        {status && <StatusBadge name={status.name} color={status.color} className="mb-1" />}
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
