import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { LocalDate } from '@/components/ui/local-date'
import type { ChangelogId } from '@quackback/ids'
import { cn } from '@/lib/shared/utils'

interface CategoryBadge {
  id: string
  name: string
  color: string
}

interface ChangelogEntryCardProps {
  id: ChangelogId
  title: string
  publishedAt: string
  categories?: CategoryBadge[]
  className?: string
}

/** The entry's date, e.g. "October 1, 2026", in the reader's zone once hydrated. */
const ENTRY_DATE: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }

/**
 * One row of the public changelog: date, categories and title, linking to the
 * entry. The body is read on the entry's own page, not inline in the list.
 */
export function ChangelogEntryCard({
  id,
  title,
  publishedAt,
  categories = [],
  className,
}: ChangelogEntryCardProps) {
  return (
    <Link
      to="/changelog/$entryId"
      params={{ entryId: id }}
      className={cn(
        'group flex items-center gap-4 rounded-lg px-3 py-4 -mx-3 transition-colors hover:bg-muted/40 lg:gap-16',
        className
      )}
    >
      {/* Date column */}
      <LocalDate
        date={publishedAt}
        options={ENTRY_DATE}
        className="hidden md:block w-40 shrink-0 text-sm text-muted-foreground"
      />

      <div className="flex-1 min-w-0">
        {/* Mobile date */}
        <LocalDate
          date={publishedAt}
          options={ENTRY_DATE}
          className="md:hidden mb-1 block text-sm text-muted-foreground"
        />

        {categories.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <span
                key={category.id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: category.color + '1a', color: category.color }}
              >
                {category.name}
              </span>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
          {title}
        </h2>
      </div>

      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  )
}
