import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { updateBoardSchema, type UpdateBoardInput } from '@/lib/shared/schemas/boards'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useNavigate } from '@tanstack/react-router'
import { useUpdateBoard } from '@/lib/client/mutations'
import { resolveBoardKind, type BoardAccess } from '@/lib/shared/db-types'
import type { BoardId } from '@quackback/ids'

interface Board {
  id: BoardId
  name: string
  slug: string
  description: string | null
  /** Decides whether this is a report board (which carries rules). */
  access?: BoardAccess | null
  settings?: { rulesMarkdown?: string } | null
}

interface BoardGeneralFormProps {
  board: Board
}

export function BoardGeneralForm({ board }: BoardGeneralFormProps) {
  const mutation = useUpdateBoard()
  const navigate = useNavigate()

  const isReportBoard = resolveBoardKind(board.access ?? undefined) === 'reports'
  const savedRules = board.settings?.rulesMarkdown ?? ''

  const form = useForm<UpdateBoardInput>({
    resolver: standardSchemaResolver(updateBoardSchema),
    defaultValues: {
      name: board.name,
      description: board.description || '',
      rulesMarkdown: savedRules,
    },
  })

  // Name and description save when a field loses focus (or on Enter), so a
  // rename never changes the URL while it is still being typed.
  function onSubmit(data: UpdateBoardInput) {
    mutation.mutate(
      {
        id: board.id,
        name: data.name,
        description: data.description,
        // Only the rules key: the server merges it into the other settings.
        ...(isReportBoard && { settings: { rulesMarkdown: data.rulesMarkdown ?? '' } }),
      },
      {
        onSuccess: (updated) => {
          if (updated.slug !== board.slug) {
            void navigate({
              to: '/admin/settings/boards/$slug',
              params: { slug: updated.slug },
              search: {},
              replace: true,
            })
          }
        },
      }
    )
  }

  const saveIfChanged = form.handleSubmit((data) => {
    if (
      data.name !== board.name ||
      (data.description ?? '') !== (board.description ?? '') ||
      (isReportBoard && (data.rulesMarkdown ?? '') !== savedRules)
    ) {
      onSubmit(data)
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={saveIfChanged} onBlur={() => void saveIfChanged()} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isReportBoard && (
          <FormField
            control={form.control}
            name="rulesMarkdown"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Report rules</FormLabel>
                <FormControl>
                  <Textarea rows={8} className="font-mono text-sm" {...field} />
                </FormControl>
                <FormDescription>
                  Shown next to the report form and on every report. Markdown supported.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </form>
    </Form>
  )
}
