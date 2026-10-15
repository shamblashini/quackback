import { Link } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'
import { LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export interface ReportTypeOption {
  id: string
  name: string
  slug: string
  description: string | null
  /** Only the reporter and the team can read reports of this type. */
  isPrivate: boolean
}

/** Small lock badge marking a private report type or report. */
export function PrivateReportBadge({ className }: { className?: string }) {
  return (
    <span
      data-testid="private-report-badge"
      className={`inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${className ?? ''}`}
    >
      <LockClosedIcon className="size-3" aria-hidden />
      <FormattedMessage id="portal.reports.private.badge" defaultMessage="Private" />
    </span>
  )
}

/**
 * Step 1 of filing a report: one card per report type the viewer can file to.
 * Picking a card puts the type's slug in the URL (`?type=`), which opens the
 * composer for it and makes the choice linkable.
 */
export function ReportTypePicker({
  types,
  status,
  boardFilter,
}: {
  types: ReportTypeOption[]
  status?: string
  boardFilter?: string
}) {
  if (types.length === 0) return null
  return (
    <section aria-labelledby="report-type-heading" className="mb-6">
      <h2 id="report-type-heading" className="text-lg font-semibold">
        <FormattedMessage
          id="portal.reports.type.heading"
          defaultMessage="What do you want to report?"
        />
      </h2>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        <FormattedMessage
          id="portal.reports.type.hint"
          defaultMessage="Pick the type of report. Each type has its own rules."
        />
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {types.map((type) => (
          <li key={type.id}>
            <Link
              to="/reports"
              search={{
                type: type.slug,
                ...(status ? { status } : {}),
                ...(boardFilter ? { board: boardFilter } : {}),
              }}
              className="flex h-full flex-col gap-1.5 rounded-lg border bg-card p-4 text-start shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center gap-2 font-semibold text-foreground">
                {type.isPrivate ? (
                  <LockClosedIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ShieldCheckIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {type.name}
              </span>
              {type.description && (
                <span className="text-sm text-muted-foreground line-clamp-3">
                  {type.description}
                </span>
              )}
              {type.isPrivate && (
                <span className="mt-auto pt-1 text-xs font-medium text-muted-foreground">
                  <FormattedMessage
                    id="portal.reports.type.private"
                    defaultMessage="Private: only you and the team can see it"
                  />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
