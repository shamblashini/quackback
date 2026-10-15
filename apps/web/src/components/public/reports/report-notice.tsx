import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { MessageMarkdown } from '@/components/shared/conversation/message-markdown'
import { cn } from '@/lib/shared/utils'

/**
 * The workspace's one report notice (`portalConfig.reportNotice`): a warning
 * every reporter reads before filing. Markdown, rendered through the same
 * sanitising renderer as the board rules, in the destructive colour. Renders
 * nothing when the notice is blank.
 */
export function ReportNotice({
  markdown,
  className,
}: {
  markdown: string | undefined | null
  className?: string
}) {
  const text = markdown?.trim()
  if (!text) return null
  return (
    <div
      role="note"
      data-testid="report-notice"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive',
        className
      )}
    >
      <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <MessageMarkdown
        text={text}
        className="font-medium text-destructive [&_a]:text-destructive [&_code]:text-destructive [&_li::marker]:text-destructive"
      />
    </div>
  )
}
