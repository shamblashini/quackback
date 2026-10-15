/**
 * Which look the portal header takes. "Reports mode" covers the reports page
 * and the detail page of any report post: the header drops the product tabs
 * and shows a way back to the portal instead.
 */
export type PortalHeaderVariant = 'default' | 'reports'

const REPORTS_ROUTE_ID = '/_portal/reports/'
const POST_DETAIL_ROUTE_ID = '/_portal/b/$slug/posts/$postId'

/** The slice of a router match this decision needs. */
export interface PortalHeaderMatch {
  routeId: string
  loaderData?: unknown
}

export function resolvePortalHeaderVariant(
  matches: ReadonlyArray<PortalHeaderMatch>
): PortalHeaderVariant {
  for (const match of matches) {
    if (match.routeId === REPORTS_ROUTE_ID) return 'reports'
    if (
      match.routeId === POST_DETAIL_ROUTE_ID &&
      (match.loaderData as { boardKind?: string } | undefined)?.boardKind === 'reports'
    ) {
      return 'reports'
    }
  }
  return 'default'
}
