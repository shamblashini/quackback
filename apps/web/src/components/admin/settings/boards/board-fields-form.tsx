/**
 * Editor for a board's custom intake fields (boards.settings.customFields):
 * the guided form people fill in on the portal next to the title and details.
 * Add, reorder, edit and remove fields; the list saves as one unit through the
 * board settings update (the server merges it into the other settings).
 * Modelled on the ticket field editor. A field's key is derived from its label
 * when it is created and is locked once the field exists, so answers already
 * stored on posts keep matching their field.
 */
import { useEffect, useState } from 'react'
import { PlusIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/solid'
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/24/outline'
import type { BoardId } from '@quackback/ids'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useUpdateBoard } from '@/lib/client/mutations'
import {
  BOARD_CUSTOM_FIELD_TYPES,
  type BoardCustomField,
  type BoardCustomFieldType,
} from '@/lib/shared/db-types'
import { BOARD_CUSTOM_FIELDS_MAX, boardCustomFieldSchema } from '@/lib/shared/schemas/boards'
import { deriveFieldKey, uniqueFieldKey } from '../tickets/form-field-schema'

export const BOARD_FIELD_TYPE_LABEL: Record<BoardCustomFieldType, string> = {
  text: 'Text',
  long_text: 'Long text',
  number: 'Number',
  select: 'Choice (select)',
  date: 'Date',
  datetime: 'Date and time',
  checkbox: 'Checkbox',
  url: 'Link (URL)',
  id_list: 'Game IDs (list)',
}

const PLACEHOLDER_TYPES: BoardCustomFieldType[] = [
  'text',
  'long_text',
  'number',
  'url',
  'id_list',
  'select',
]

interface Board {
  id: BoardId
  name: string
  settings?: { customFields?: BoardCustomField[] } | null
}

export interface BoardFieldsFormProps {
  board: Board
}

export function BoardFieldsForm({ board }: BoardFieldsFormProps) {
  const mutation = useUpdateBoard()
  const saved = board.settings?.customFields ?? []
  const [fields, setFields] = useState<BoardCustomField[]>(saved)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BoardCustomField | null>(null)
  const [toDelete, setToDelete] = useState<BoardCustomField | null>(null)

  const dirty = JSON.stringify(fields) !== JSON.stringify(saved)
  const atLimit = fields.length >= BOARD_CUSTOM_FIELDS_MAX

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    setFields(next)
  }

  function saveField(draft: BoardCustomField) {
    const exists = fields.some((f) => f.key === draft.key)
    setFields(exists ? fields.map((f) => (f.key === draft.key ? draft : f)) : [...fields, draft])
  }

  function save() {
    mutation.mutate({ id: board.id, settings: { customFields: fields } })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Form fields</p>
        <p className="text-sm text-muted-foreground">
          Extra questions people answer when they post to this board, shown under the details box.
          Answers appear on the post, in the same order.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border/50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Fields ({fields.length}/{BOARD_CUSTOM_FIELDS_MAX})
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={atLimit}
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <PlusIcon className="h-4 w-4" /> Add field
          </Button>
        </div>

        <div className="space-y-1.5">
          {fields.map((field, index) => (
            <div
              key={field.key}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-card px-3 py-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Move ${field.label} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpIcon className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label={`Move ${field.label} down`}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="min-w-0 flex-1 truncate text-sm">{field.label}</span>
              <Badge variant="outline">{BOARD_FIELD_TYPE_LABEL[field.type]}</Badge>
              {field.required && <Badge variant="subtle">Required</Badge>}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => {
                  setEditing(field)
                  setDialogOpen(true)
                }}
                title="Edit field"
                aria-label={`Edit ${field.label}`}
              >
                <PencilSquareIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setToDelete(field)}
                title="Delete field"
                aria-label={`Delete ${field.label}`}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {fields.length === 0 && (
          <p className="py-1 text-xs text-muted-foreground">No form fields yet.</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" disabled={!dirty || mutation.isPending} onClick={save}>
          {mutation.isPending ? 'Saving...' : 'Save fields'}
        </Button>
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => setFields(saved)}>
            Discard changes
          </Button>
        )}
        {mutation.isError && (
          <p className="text-xs text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : 'Could not save the fields'}
          </p>
        )}
      </div>

      <FieldDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        field={editing}
        existingKeys={fields.map((f) => f.key)}
        onSubmit={saveField}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        variant="destructive"
        title="Delete field?"
        description={
          toDelete
            ? `"${toDelete.label}" is removed from this board's form when you save. Answers already on posts are kept but no longer shown.`
            : undefined
        }
        confirmLabel="Delete field"
        onConfirm={() => {
          if (toDelete) setFields(fields.filter((f) => f.key !== toDelete.key))
          setToDelete(null)
        }}
      />
    </div>
  )
}

interface FieldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: BoardCustomField | null
  existingKeys: string[]
  onSubmit: (field: BoardCustomField) => void
}

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function FieldDialog({ open, onOpenChange, field, existingKeys, onSubmit }: FieldDialogProps) {
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [keyEdited, setKeyEdited] = useState(false)
  const [fieldType, setFieldType] = useState<BoardCustomFieldType>('text')
  const [required, setRequired] = useState(false)
  const [helpText, setHelpText] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const [optionsText, setOptionsText] = useState('')
  const [patternRegex, setPatternRegex] = useState('')
  const [patternMessage, setPatternMessage] = useState('')
  const [domainsText, setDomainsText] = useState('')
  const [olderThanHours, setOlderThanHours] = useState('')
  const [warnMessage, setWarnMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setKeyEdited(false)
    setLabel(field?.label ?? '')
    setKey(field?.key ?? '')
    setFieldType(field?.type ?? 'text')
    setRequired(field?.required ?? false)
    setHelpText(field?.helpText ?? '')
    setPlaceholder(field?.placeholder ?? '')
    setOptionsText((field?.options ?? []).join('\n'))
    setPatternRegex(field?.pattern?.regex ?? '')
    setPatternMessage(field?.pattern?.message ?? '')
    setDomainsText((field?.warnDomains ?? []).join('\n'))
    setOlderThanHours(field?.warnOlderThanHours ? String(field.warnOlderThanHours) : '')
    setWarnMessage(field?.warnMessage ?? '')
  }, [open, field])

  const isNew = field === null
  const isText = fieldType === 'text' || fieldType === 'long_text'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const hours = Number(olderThanHours)
    const domains = splitLines(domainsText.replace(/,/g, '\n'))
    const finalKey = isNew
      ? uniqueFieldKey(key.trim() || deriveFieldKey(label), existingKeys)
      : field.key

    const draft = {
      key: finalKey,
      label,
      type: fieldType,
      required,
      ...(helpText.trim() ? { helpText } : {}),
      ...(placeholder.trim() && PLACEHOLDER_TYPES.includes(fieldType) ? { placeholder } : {}),
      ...(fieldType === 'select' ? { options: splitLines(optionsText) } : {}),
      ...(isText && patternRegex.trim()
        ? { pattern: { regex: patternRegex, message: patternMessage || 'Invalid format' } }
        : {}),
      ...(fieldType === 'url' && domains.length > 0 ? { warnDomains: domains } : {}),
      ...(fieldType === 'datetime' && olderThanHours.trim() && hours > 0
        ? { warnOlderThanHours: Math.round(hours) }
        : {}),
      ...(warnMessage.trim() ? { warnMessage } : {}),
    }

    const parsed = boardCustomFieldSchema.safeParse(draft)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid field')
      return
    }
    onSubmit(parsed.data as BoardCustomField)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{field ? 'Edit field' : 'Add field'}</DialogTitle>
          <DialogDescription>
            Form fields appear on this board&apos;s post form, under the details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="board-field-label">Field name</Label>
            <Input
              id="board-field-label"
              value={label}
              maxLength={120}
              onChange={(e) => {
                setLabel(e.target.value)
                if (isNew && !keyEdited) setKey(deriveFieldKey(e.target.value))
              }}
              placeholder="e.g. Video link"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="board-field-key">Key</Label>
            <Input
              id="board-field-key"
              value={key}
              disabled={!isNew}
              maxLength={64}
              onChange={(e) => {
                setKeyEdited(true)
                setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
              }}
            />
            <p className="text-xs text-muted-foreground">
              {isNew
                ? 'Built from the name. It cannot change after the field is saved.'
                : 'The key is locked so existing answers keep matching this field.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={fieldType}
              onValueChange={(v) => setFieldType(v as BoardCustomFieldType)}
            >
              <SelectTrigger className="w-full" aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOARD_CUSTOM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {BOARD_FIELD_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="board-field-help">Help text</Label>
            <Textarea
              id="board-field-help"
              value={helpText}
              rows={2}
              maxLength={1000}
              onChange={(e) => setHelpText(e.target.value)}
              placeholder="Shown under the field name. Line breaks are kept."
            />
          </div>

          {PLACEHOLDER_TYPES.includes(fieldType) && (
            <div className="space-y-2">
              <Label htmlFor="board-field-placeholder">Placeholder</Label>
              <Input
                id="board-field-placeholder"
                value={placeholder}
                maxLength={200}
                onChange={(e) => setPlaceholder(e.target.value)}
              />
            </div>
          )}

          {fieldType === 'select' && (
            <div className="space-y-2">
              <Label htmlFor="board-field-options">Options</Label>
              <Textarea
                id="board-field-options"
                value={optionsText}
                rows={4}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="One option per line"
              />
            </div>
          )}

          {isText && (
            <div className="space-y-2 rounded-md border border-border/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Format check (optional)</p>
              <Label htmlFor="board-field-regex">Pattern (regular expression)</Label>
              <Input
                id="board-field-regex"
                value={patternRegex}
                maxLength={200}
                className="font-mono"
                onChange={(e) => setPatternRegex(e.target.value)}
                placeholder="^#\d+$"
              />
              <Label htmlFor="board-field-regex-message">Message when it does not match</Label>
              <Input
                id="board-field-regex-message"
                value={patternMessage}
                maxLength={300}
                onChange={(e) => setPatternMessage(e.target.value)}
              />
            </div>
          )}

          {fieldType === 'url' && (
            <div className="space-y-2 rounded-md border border-border/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Warn about other sites (optional)
              </p>
              <Label htmlFor="board-field-domains">Expected domains</Label>
              <Textarea
                id="board-field-domains"
                value={domainsText}
                rows={2}
                onChange={(e) => setDomainsText(e.target.value)}
                placeholder={'youtube.com\nyoutu.be'}
              />
              <p className="text-xs text-muted-foreground">
                A link to any other site shows the warning below. It never blocks posting.
              </p>
            </div>
          )}

          {fieldType === 'datetime' && (
            <div className="space-y-2 rounded-md border border-border/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Warn about old dates (optional)
              </p>
              <Label htmlFor="board-field-older">Warn when older than (hours)</Label>
              <Input
                id="board-field-older"
                type="number"
                min={1}
                value={olderThanHours}
                onChange={(e) => setOlderThanHours(e.target.value)}
                placeholder="48"
              />
              <p className="text-xs text-muted-foreground">
                An older date shows the warning below. It never blocks posting.
              </p>
            </div>
          )}

          {(fieldType === 'url' || fieldType === 'datetime') && (
            <div className="space-y-2">
              <Label htmlFor="board-field-warn">Warning text</Label>
              <Input
                id="board-field-warn"
                value={warnMessage}
                maxLength={300}
                onChange={(e) => setWarnMessage(e.target.value)}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={required}
              onCheckedChange={(v) => setRequired(v === true)}
              data-in-label
            />
            Required
          </label>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim()}>
              {field ? 'Save field' : 'Add field'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
