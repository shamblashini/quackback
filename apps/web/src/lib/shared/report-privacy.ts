/**
 * Private report boards.
 *
 * A report board (`access.kind === 'reports'`) whose view tier is `'team'` is
 * private: the team sees every report on it, a signed-in reporter sees only the
 * reports they filed, and nobody else sees anything. Pure and client-safe so the
 * policy layer, the admin Access tab and the portal share one definition.
 */
import type { AccessTier, BoardKind } from '@/lib/shared/db-types'

export function isPrivateReportAccess(
  access: { kind?: BoardKind; view?: AccessTier } | null | undefined
): boolean {
  return access?.kind === 'reports' && access.view === 'team'
}
