import { useId } from 'react'
import { Link } from '@tanstack/react-router'
import { FormattedMessage } from 'react-intl'
import { ArrowLeftIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { Checkbox } from '@/components/ui/checkbox'
import { ReportNotice } from './report-notice'
import { ReportRulesCollapsible } from './report-rules'

export interface ReportGuideConfig {
  boardId: string
  boardName: string
  isPrivate: boolean
  /** The workspace-wide Markdown notice, shown first and in red. */
  notice: string
  /** The chosen type's Markdown rules; blank when it has none. */
  rules: string
  /** More than one type is open to the viewer, so "Change type" has a target. */
  canChangeType: boolean
  /** Where "Change type" goes (the picker, with the list filters kept). */
  changeTypeSearch: { status?: string; board?: string }
}

/** Whether the composer must hold submit until the rules are acknowledged. */
export function reportGuideNeedsAcknowledgement(guide: ReportGuideConfig | undefined): boolean {
  return !!guide && guide.rules.trim().length > 0
}

/**
 * Step 2 of filing a report, shown at the top of the composer: the chosen
 * type, the workspace warning, the type's rules (open by default) and the
 * confirmation that gates Submit when the type has rules.
 */
export function ReportGuide({
  guide,
  accepted,
  onAcceptedChange,
}: {
  guide: ReportGuideConfig
  accepted: boolean
  onAcceptedChange: (accepted: boolean) => void
}) {
  const checkboxId = useId()
  const rules = guide.rules.trim()
  return (
    <div className="space-y-3 px-4 pb-3 pt-3 sm:px-5" data-testid="report-guide">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {guide.isPrivate && (
            <LockClosedIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="font-semibold text-foreground">{guide.boardName}</span>
        </div>
        {guide.canChangeType && (
          <Link
            to="/reports"
            search={guide.changeTypeSearch}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ArrowLeftIcon className="size-3" aria-hidden />
            <FormattedMessage id="portal.reports.type.change" defaultMessage="Change type" />
          </Link>
        )}
      </div>

      {guide.isPrivate && (
        <p className="text-xs text-muted-foreground">
          <FormattedMessage
            id="portal.reports.privateNote"
            defaultMessage="This type is private: only you and the team can read the report and the replies."
          />
        </p>
      )}

      <ReportNotice markdown={guide.notice} />

      {rules && (
        // On wide screens the page's Rules sidebar already shows this type's
        // rules next to the form; inline they would appear twice.
        <ReportRulesCollapsible
          defaultOpen
          className="lg:hidden"
          sections={[{ id: guide.boardId, name: guide.boardName, markdown: rules }]}
        />
      )}

      {rules && (
        <div className="flex items-start gap-2">
          <Checkbox
            id={checkboxId}
            checked={accepted}
            onCheckedChange={(value) => onAcceptedChange(value === true)}
            className="mt-0.5"
          />
          <label htmlFor={checkboxId} className="cursor-pointer text-sm text-foreground">
            <FormattedMessage
              id="portal.reports.guide.confirm"
              defaultMessage="I confirm that I have read the submission rules"
            />
          </label>
        </div>
      )}
    </div>
  )
}
