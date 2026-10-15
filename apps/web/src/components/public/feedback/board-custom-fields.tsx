/**
 * Renders a board's configured custom intake fields
 * (boards.settings.customFields) on the public submission form, each in its
 * declared input type, with help text, per-field inline errors and amber soft
 * warnings. Values are reported upward by field key; the same
 * `validatePostCustomFieldValues` rules the server enforces apply here, so
 * client and server never drift. Soft warnings never block anything.
 */
import { useEffect, useState } from 'react'
import { useIntl, type IntlShape } from 'react-intl'
import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BoardCustomField } from '@/lib/shared/db-types'
import {
  getPostCustomFieldWarnings,
  POST_CUSTOM_FIELD_TEXT_MAX_LENGTH,
  validatePostCustomFieldValues,
  type PostCustomFieldError,
} from '@/lib/shared/post-custom-fields'
import { cn } from '@/lib/shared/utils'

/**
 * Select fields with at most this many options render as visible one-tap
 * choices; longer lists stay a closed dropdown to keep the form compact.
 */
export const PILL_SELECT_MAX_OPTIONS = 6

export interface BoardCustomFieldsProps {
  fields: BoardCustomField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  /** Show every field's error, not just those already visited (set after a
   *  failed submit attempt). */
  showAllErrors?: boolean
}

type OnChange = (key: string, value: unknown) => void

/** Localised text for a validation failure; a pattern failure uses the
 *  admin's own message. */
function errorText(intl: IntlShape, error: PostCustomFieldError): string {
  switch (error.code) {
    case 'required':
      return intl.formatMessage({
        id: 'portal.feedback.customFields.error.required',
        defaultMessage: 'This field is required',
      })
    case 'too_long':
      return intl.formatMessage(
        {
          id: 'portal.feedback.customFields.error.tooLong',
          defaultMessage: 'Too long (at most {max} characters)',
        },
        { max: intl.formatNumber(POST_CUSTOM_FIELD_TEXT_MAX_LENGTH) }
      )
    case 'number':
      return intl.formatMessage({
        id: 'portal.feedback.customFields.error.number',
        defaultMessage: 'Enter a number',
      })
    case 'option':
      return intl.formatMessage({
        id: 'portal.feedback.customFields.error.option',
        defaultMessage: 'Choose one of the options',
      })
    case 'date':
      return intl.formatMessage({
        id: 'portal.feedback.customFields.error.date',
        defaultMessage: 'Enter a valid date',
      })
    case 'datetime':
      return intl.formatMessage({
        id: 'portal.feedback.customFields.error.datetime',
        defaultMessage: 'Enter a valid date and time',
      })
    case 'url':
      return intl.formatMessage({
        id: 'portal.feedback.customFields.error.url',
        defaultMessage: 'Enter a link starting with http:// or https://',
      })
    case 'id_list':
      return intl.formatMessage({
        id: 'portal.feedback.customFields.error.idList',
        defaultMessage: 'Enter one or more ID numbers, like #1, #12',
      })
    case 'pattern':
      return error.message
  }
}

/** ISO instant -> the `YYYY-MM-DDTHH:mm` a datetime-local input shows (viewer's zone). */
function isoToLocalInput(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A datetime-local value -> an ISO instant, so the server never guesses a zone. */
function localInputToIso(local: string): string {
  if (!local) return ''
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function BoardCustomFields({
  fields,
  values,
  onChange,
  showAllErrors = false,
}: BoardCustomFieldsProps) {
  const intl = useIntl()
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  // The composer clears every answer after a submit or board switch; start the
  // visited-state over with it so a fresh form shows no errors.
  const answered = Object.keys(values).length > 0
  useEffect(() => {
    if (!answered) setTouched({})
  }, [answered])
  if (fields.length === 0) return null

  const warnings = getPostCustomFieldWarnings(fields, values)

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const result = validatePostCustomFieldValues([field], values)
        const error = !result.ok && (showAllErrors || touched[field.key]) ? result.errors[0] : null
        return (
          <FieldControl
            key={field.key}
            field={field}
            value={values[field.key]}
            error={error ? errorText(intl, error) : null}
            warning={warnings.find((w) => w.key === field.key)?.message ?? null}
            onTouch={() =>
              setTouched((prev) => (prev[field.key] ? prev : { ...prev, [field.key]: true }))
            }
            onChange={onChange}
          />
        )
      })}
    </div>
  )
}

interface FieldControlProps {
  field: BoardCustomField
  value: unknown
  error: string | null
  warning: string | null
  onTouch: () => void
  onChange: OnChange
}

function FieldControl({ field, value, error, warning, onTouch, onChange }: FieldControlProps) {
  const id = `board-custom-field-${field.key}`
  const helpId = field.helpText ? `${id}-help` : undefined
  const messageId = error || warning ? `${id}-message` : undefined
  const describedBy = [helpId, messageId].filter(Boolean).join(' ') || undefined
  const text = typeof value === 'string' ? value : ''
  const common = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onBlur: onTouch,
  }

  const required = field.required && <span className="text-destructive ms-0.5">*</span>
  const help = field.helpText && (
    <p id={helpId} className="whitespace-pre-line text-xs text-muted-foreground">
      {field.helpText}
    </p>
  )
  const message = (error || warning) && (
    <p
      id={messageId}
      role={error ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-1 text-xs',
        error ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
      )}
    >
      {!error && <ExclamationTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span>{error ?? warning}</span>
    </p>
  )

  // Checkboxes carry their label inline (a clickable row), not above the control.
  if (field.type === 'checkbox') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => {
              onTouch()
              onChange(field.key, checked === true)
            }}
            aria-label={field.label}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
          <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
            {field.label}
            {required}
          </Label>
        </div>
        {help}
        {message}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {field.label}
        {required}
      </Label>
      {help}
      {field.type === 'long_text' ? (
        <Textarea
          {...common}
          rows={3}
          value={text}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.type === 'number' ? (
        <Input
          {...common}
          type="number"
          value={typeof value === 'number' ? String(value) : text}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.type === 'date' ? (
        <Input
          {...common}
          type="date"
          value={text}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.type === 'datetime' ? (
        <Input
          {...common}
          type="datetime-local"
          value={isoToLocalInput(value)}
          onChange={(e) => onChange(field.key, localInputToIso(e.target.value))}
        />
      ) : field.type === 'url' ? (
        <Input
          {...common}
          type="url"
          inputMode="url"
          autoComplete="off"
          value={text}
          placeholder={field.placeholder ?? 'https://'}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.type === 'id_list' ? (
        <Input
          {...common}
          type="text"
          inputMode="text"
          autoComplete="off"
          value={text}
          placeholder={field.placeholder ?? '#1, #12'}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.type === 'select' ? (
        <SelectControl
          field={field}
          id={id}
          value={value}
          describedBy={describedBy}
          onTouch={onTouch}
          onChange={onChange}
        />
      ) : (
        <Input
          {...common}
          type="text"
          value={text}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
      {message}
    </div>
  )
}

interface SelectControlProps {
  field: BoardCustomField
  id: string
  value: unknown
  describedBy?: string
  onTouch: () => void
  onChange: OnChange
}

function SelectControl({ field, id, value, describedBy, onTouch, onChange }: SelectControlProps) {
  const options = field.options ?? []
  const selected = typeof value === 'string' ? value : undefined
  const pick = (option: string) => {
    onTouch()
    onChange(field.key, option)
  }

  if (options.length > PILL_SELECT_MAX_OPTIONS) {
    return (
      <Select value={selected} onValueChange={pick}>
        <SelectTrigger
          id={id}
          size="sm"
          className="w-full"
          aria-label={field.label}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={field.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label={field.label}
      aria-describedby={describedBy}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => {
        const isSelected = option === selected
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => pick(option)}
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors',
              isSelected
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
