/**
 * The answers a submitter gave to a board's custom intake fields
 * (posts.custom_field_values), shown as a labelled definition list in the
 * board's field order. Values follow the post's own visibility, so there is no
 * extra gating here. Fields without an answer are skipped; answers whose field
 * was later removed from the board are not shown.
 */
import { useIntl, type IntlShape } from 'react-intl'
import type { BoardCustomField } from '@/lib/shared/db-types'

export interface CustomFieldAnswersProps {
  fields?: BoardCustomField[] | null
  values?: Record<string, unknown> | null
}

/** `YYYY-MM-DD` as a local calendar date (new Date(str) would shift by zone). */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function AnswerValue({
  field,
  value,
  intl,
}: {
  field: BoardCustomField
  value: unknown
  intl: IntlShape
}) {
  if (field.type === 'checkbox') {
    const yes = value === true
    return (
      <span
        aria-label={
          yes
            ? intl.formatMessage({ id: 'portal.customFieldAnswers.yes', defaultMessage: 'Yes' })
            : intl.formatMessage({ id: 'portal.customFieldAnswers.no', defaultMessage: 'No' })
        }
      >
        {yes ? '✓' : '✗'}
      </span>
    )
  }

  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''

  if (field.type === 'url' && isSafeHttpUrl(text)) {
    return (
      <a
        href={text}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-primary hover:underline"
      >
        {text}
      </a>
    )
  }
  if (field.type === 'datetime') {
    const date = new Date(text)
    if (!Number.isNaN(date.getTime())) {
      return <>{intl.formatDate(date, { dateStyle: 'medium', timeStyle: 'short' })}</>
    }
  }
  if (field.type === 'date') {
    const date = parseDateOnly(text)
    if (date) return <>{intl.formatDate(date, { dateStyle: 'medium' })}</>
  }
  return <>{text}</>
}

export function CustomFieldAnswers({ fields, values }: CustomFieldAnswersProps) {
  const intl = useIntl()
  if (!fields?.length || !values) return null

  const rows = fields.filter((field) => {
    const value = values[field.key]
    if (field.type === 'checkbox') return typeof value === 'boolean'
    return value !== undefined && value !== null && String(value).trim() !== ''
  })
  if (rows.length === 0) return null

  return (
    <dl className="mb-6 grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border/50 bg-muted/20 p-4 text-sm sm:grid-cols-[minmax(8rem,max-content)_1fr]">
      {rows.map((field) => (
        <div key={field.key} className="contents">
          <dt className="text-muted-foreground">{field.label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words text-foreground">
            <AnswerValue field={field} value={values[field.key]} intl={intl} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
