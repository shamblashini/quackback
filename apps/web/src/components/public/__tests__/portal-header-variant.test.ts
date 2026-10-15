import { describe, it, expect } from 'vitest'
import { resolvePortalHeaderVariant } from '../portal-header-variant'

const portal = { routeId: '/_portal' }

describe('resolvePortalHeaderVariant', () => {
  it('is reports mode on the reports page', () => {
    expect(resolvePortalHeaderVariant([portal, { routeId: '/_portal/reports/' }])).toBe('reports')
  })

  it('is reports mode on a report post', () => {
    expect(
      resolvePortalHeaderVariant([
        portal,
        { routeId: '/_portal/b/$slug/posts/$postId', loaderData: { boardKind: 'reports' } },
      ])
    ).toBe('reports')
  })

  it('stays default on a feedback post', () => {
    expect(
      resolvePortalHeaderVariant([
        portal,
        { routeId: '/_portal/b/$slug/posts/$postId', loaderData: { boardKind: 'feedback' } },
      ])
    ).toBe('default')
  })

  it('stays default while the post loader data is missing', () => {
    expect(
      resolvePortalHeaderVariant([portal, { routeId: '/_portal/b/$slug/posts/$postId' }])
    ).toBe('default')
  })

  it('stays default on other portal pages', () => {
    expect(resolvePortalHeaderVariant([portal, { routeId: '/_portal/roadmap/' }])).toBe('default')
    expect(resolvePortalHeaderVariant([])).toBe('default')
  })
})
