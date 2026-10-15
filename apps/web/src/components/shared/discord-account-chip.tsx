import { useIntl } from 'react-intl'
import { toast } from 'sonner'
import {
  CheckIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { useCopyToClipboard } from '@/lib/client/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/shared/utils'

interface DiscordAccountChipProps {
  /** Discord user snowflake id. Renders nothing when empty. */
  discordId: string | null | undefined
  className?: string
}

const ICON_BUTTON =
  'flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors'

/**
 * Team-only moderation aid: shows an author's Discord user id with copy and
 * "open in Discord" actions. Callers must only pass an id the viewer is
 * entitled to see (the server omits it for non-team viewers).
 */
export function DiscordAccountChip({ discordId, className }: DiscordAccountChipProps) {
  const intl = useIntl()
  const { copied, copy } = useCopyToClipboard()

  if (!discordId) return null

  const copyLabel = intl.formatMessage({
    id: 'portal.postDetail.metadata.discordCopy',
    defaultMessage: 'Copy',
  })
  const copiedLabel = intl.formatMessage({
    id: 'portal.postDetail.metadata.discordCopied',
    defaultMessage: 'Copied',
  })

  const handleCopy = async () => {
    const ok = await copy(discordId)
    if (ok) {
      toast.success(copiedLabel)
    } else {
      toast.error(
        intl.formatMessage({
          id: 'portal.postDetail.metadata.discordCopyFailed',
          defaultMessage: "Couldn't copy",
        })
      )
    }
  }

  return (
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">
          {intl.formatMessage({
            id: 'portal.postDetail.metadata.discordId',
            defaultMessage: 'Discord ID',
          })}
        </span>
        <code className="truncate font-mono text-sm text-foreground" data-testid="discord-id">
          {discordId}
        </code>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? copiedLabel : copyLabel}
          title={copied ? copiedLabel : copyLabel}
          className={ICON_BUTTON}
        >
          {copied ? (
            <CheckIcon className="h-4 w-4 text-green-500" />
          ) : (
            <ClipboardDocumentIcon className="h-4 w-4" />
          )}
        </button>
        <a
          href={`https://discord.com/users/${encodeURIComponent(discordId)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={intl.formatMessage({
            id: 'portal.postDetail.metadata.discordOpen',
            defaultMessage: 'Open in Discord',
          })}
          title={intl.formatMessage({
            id: 'portal.postDetail.metadata.discordOpen',
            defaultMessage: 'Open in Discord',
          })}
          className={ICON_BUTTON}
        >
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      </div>
    </div>
  )
}
