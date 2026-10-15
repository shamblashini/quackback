import { useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { BookOpenIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { MessageMarkdown } from '@/components/shared/conversation/message-markdown'
import { cn } from '@/lib/shared/utils'

export interface ReportRulesSection {
  id: string
  /** Board name, shown above the text when several boards have rules. */
  name: string
  markdown: string
}

/**
 * The boards that have rules, ready to render. Blank rules count as none, so
 * a board whose admin cleared the field never shows an empty card.
 */
export function collectReportRules(
  boards: ReadonlyArray<{
    id: string
    name: string
    settings?: { rulesMarkdown?: string } | null
  }>
): ReportRulesSection[] {
  return boards.flatMap((board) => {
    const markdown = board.settings?.rulesMarkdown?.trim()
    return markdown ? [{ id: board.id, name: board.name, markdown }] : []
  })
}

function RulesBody({ sections }: { sections: ReportRulesSection[] }) {
  // Board names only earn their place when there is more than one set of rules.
  const labelled = sections.length > 1
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.id}>
          {labelled && <h3 className="mb-1 text-sm font-semibold">{section.name}</h3>}
          <MessageMarkdown text={section.markdown} />
        </section>
      ))}
    </div>
  )
}

function RulesTitle() {
  return (
    <span className="flex items-center gap-2 text-sm font-semibold">
      <BookOpenIcon className="size-4 text-destructive" aria-hidden />
      <FormattedMessage id="portal.reports.rules.title" defaultMessage="Rules" />
    </span>
  )
}

/**
 * The rules as a card. Sticky on desktop when `sticky` is set (the reports
 * page sidebar); renders nothing without rules.
 */
export function ReportRulesCard({
  sections,
  sticky = false,
  className,
}: {
  sections: ReportRulesSection[]
  sticky?: boolean
  className?: string
}) {
  if (sections.length === 0) return null
  return (
    <aside
      data-testid="report-rules"
      className={cn(
        'rounded-lg border bg-card p-4',
        sticky && 'lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto',
        className
      )}
    >
      <h2 className="mb-3">
        <RulesTitle />
      </h2>
      <RulesBody sections={sections} />
    </aside>
  )
}

/** The rules as a collapsible card (closed unless `defaultOpen`). */
export function ReportRulesCollapsible({
  sections,
  className,
  defaultOpen = false,
}: {
  sections: ReportRulesSection[]
  className?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (sections.length === 0) return null
  return (
    <aside
      data-testid="report-rules-collapsible"
      className={cn('rounded-lg border bg-card', className)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start"
      >
        <RulesTitle />
        <ChevronDownIcon className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t px-4 py-3">
          <RulesBody sections={sections} />
        </div>
      )}
    </aside>
  )
}
