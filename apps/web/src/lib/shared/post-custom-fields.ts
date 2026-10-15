/**
 * Board custom intake fields (boards.settings.customFields): client-safe
 * validation of submitted values against a board's declared field set.
 *
 * No server/db imports — the public submission form (inline validation) and
 * the createPost write path both run this, so the two never drift. Mirrors
 * the ticket intake-form validator contract for the same reason.
 *
 * Only declared field keys are accepted; any other key in `values` is
 * dropped, never trusted (an unknown key can't be smuggled into the post's
 * customFieldValues column). Per-type rules: a required field must be present
 * and non-empty; `select` must be one of its `options`; `number` must be
 * finite; `date` must be an ISO date; `datetime` an ISO moment with an offset;
 * `url` an http(s) link; `id_list` one or more game ids (normalised to
 * "#1, #12"); `checkbox` must be a boolean. Text fields may carry an admin
 * `pattern`. Coerces to the field's canonical stored type.
 *
 * Soft warnings (`getPostCustomFieldWarnings`) are separate on purpose: only
 * the portal form calls them, so the server can never reject on a warning.
 */
import type { BoardCustomField, CustomFieldValues } from '@/lib/shared/db-types'

/** Upper bound on a stored text/long_text answer. Answers land in the post's
 *  customFieldValues JSON, so — like the 10,000-char content cap — a bound
 *  keeps an anonymous submitter from writing unbounded blobs into the
 *  column. */
export const POST_CUSTOM_FIELD_TEXT_MAX_LENGTH = 4000

/** Longest `pattern.regex` an admin can configure (and the validator will run). */
export const POST_CUSTOM_FIELD_PATTERN_MAX_LENGTH = 200

/** Machine-readable failure kind, so the portal can localise the message. */
export type PostCustomFieldErrorCode =
  | 'required'
  | 'too_long'
  | 'number'
  | 'option'
  | 'date'
  | 'datetime'
  | 'url'
  | 'id_list'
  | 'pattern'

/** One field-level validation failure from `validatePostCustomFieldValues`. */
export interface PostCustomFieldError {
  key: string
  /** English message (or the field's own `pattern.message`). */
  message: string
  code: PostCustomFieldErrorCode
}

/** A soft warning: shown to the submitter, never blocks submission. */
export interface PostCustomFieldWarning {
  key: string
  message: string
}

/** Compile a pattern; null when it is empty, too long or not a valid regex. */
export function compilePostCustomFieldPattern(regex: string): RegExp | null {
  if (!regex || regex.length > POST_CUSTOM_FIELD_PATTERN_MAX_LENGTH) return null
  try {
    return new RegExp(regex)
  } catch {
    return null
  }
}

/** ISO 8601 date-time that carries an explicit offset (or Z). A bare local
 *  value would be parsed in the server's timezone, so it is not accepted. */
const ISO_DATETIME_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

/** Parse a game-id list ("1 12", "#1,#12") into canonical "#1, #12"; null when invalid. */
export function normalizeIdList(raw: string): string | null {
  const tokens = raw.split(/[,\s]+/).filter(Boolean)
  if (tokens.length === 0) return null
  const ids: string[] = []
  for (const token of tokens) {
    if (!/^#?\d{1,12}$/.test(token)) return null
    ids.push(`#${token.replace('#', '')}`)
  }
  return ids.join(', ')
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function hostMatches(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, '')
  const d = domain.toLowerCase().replace(/^www\./, '')
  return h === d || h.endsWith(`.${d}`)
}

/**
 * Soft warnings for the current answers (url off the allowed domains, datetime
 * too old). Portal-only: the server never calls this, so a warning can never
 * reject a submission. Empty / invalid answers produce no warning (the
 * validator reports those).
 */
export function getPostCustomFieldWarnings(
  fields: BoardCustomField[],
  values: Record<string, unknown>,
  now: number = Date.now()
): PostCustomFieldWarning[] {
  const warnings: PostCustomFieldWarning[] = []
  for (const field of fields) {
    if (!field.warnMessage) continue
    const raw = values[field.key]
    if (typeof raw !== 'string' || raw.trim() === '') continue
    if (field.type === 'url' && field.warnDomains?.length) {
      const url = parseHttpUrl(raw)
      if (url && !field.warnDomains.some((d) => hostMatches(url.hostname, d))) {
        warnings.push({ key: field.key, message: field.warnMessage })
      }
    }
    if (field.type === 'datetime' && field.warnOlderThanHours) {
      const at = Date.parse(raw)
      if (!Number.isNaN(at) && now - at > field.warnOlderThanHours * 3_600_000) {
        warnings.push({ key: field.key, message: field.warnMessage })
      }
    }
  }
  return warnings
}

export function validatePostCustomFieldValues(
  fields: BoardCustomField[],
  values: Record<string, unknown>
): { ok: true; values: CustomFieldValues } | { ok: false; errors: PostCustomFieldError[] } {
  const errors: PostCustomFieldError[] = []
  const cleaned: CustomFieldValues = {}

  for (const field of fields) {
    const raw = values[field.key]
    const missing =
      raw === undefined || raw === null || (typeof raw === 'string' && raw.trim().length === 0)
    const fail = (code: PostCustomFieldErrorCode, message: string) =>
      errors.push({ key: field.key, message, code })

    if (missing) {
      if (field.required && field.type !== 'checkbox') {
        fail('required', `${field.label} is required`)
      }
      // A required checkbox means "must be checked" — handled in its case below.
      if (field.type !== 'checkbox') continue
    }

    switch (field.type) {
      case 'text':
      case 'long_text': {
        const str = typeof raw === 'string' ? raw : String(raw ?? '')
        if (str.length > POST_CUSTOM_FIELD_TEXT_MAX_LENGTH) {
          fail(
            'too_long',
            `${field.label} must be ${POST_CUSTOM_FIELD_TEXT_MAX_LENGTH} characters or less`
          )
          break
        }
        // An unusable pattern (too long / invalid regex) is ignored rather than
        // blocking every submitter on an admin typo; the settings schema
        // refuses to save one.
        const pattern = field.pattern ? compilePostCustomFieldPattern(field.pattern.regex) : null
        if (pattern && !pattern.test(str)) {
          fail('pattern', field.pattern?.message || `${field.label} is not in the expected format`)
          break
        }
        cleaned[field.key] = str
        break
      }
      case 'number': {
        const num = typeof raw === 'number' ? raw : Number(raw)
        if (!Number.isFinite(num)) {
          fail('number', `${field.label} must be a number`)
          break
        }
        cleaned[field.key] = num
        break
      }
      case 'select': {
        const str = typeof raw === 'string' ? raw : String(raw ?? '')
        if (!(field.options ?? []).includes(str)) {
          fail('option', `${field.label} is not a valid option`)
          break
        }
        cleaned[field.key] = str
        break
      }
      case 'date': {
        const str = typeof raw === 'string' ? raw : ''
        // ISO date (YYYY-MM-DD) or full ISO datetime; must parse to a real date.
        if (!/^\d{4}-\d{2}-\d{2}/.test(str) || Number.isNaN(Date.parse(str))) {
          fail('date', `${field.label} must be a valid date`)
          break
        }
        cleaned[field.key] = str
        break
      }
      case 'datetime': {
        const str = typeof raw === 'string' ? raw.trim() : ''
        if (!ISO_DATETIME_WITH_OFFSET.test(str) || Number.isNaN(Date.parse(str))) {
          fail('datetime', `${field.label} must be a valid date and time`)
          break
        }
        cleaned[field.key] = str
        break
      }
      case 'url': {
        const str = typeof raw === 'string' ? raw.trim() : ''
        if (str.length > 2000 || !parseHttpUrl(str)) {
          fail('url', `${field.label} must be a link starting with http:// or https://`)
          break
        }
        cleaned[field.key] = str
        break
      }
      case 'id_list': {
        const normalized = typeof raw === 'string' ? normalizeIdList(raw) : null
        if (!normalized || normalized.length > 500) {
          fail('id_list', `${field.label} must be one or more ID numbers, like #1, #12`)
          break
        }
        cleaned[field.key] = normalized
        break
      }
      case 'checkbox': {
        const bool = raw === true || raw === 'true'
        if (field.required && !bool) {
          fail('required', `${field.label} is required`)
          break
        }
        cleaned[field.key] = bool
        break
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, values: cleaned }
}
