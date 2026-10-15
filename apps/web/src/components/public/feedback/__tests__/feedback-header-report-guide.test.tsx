// @vitest-environment happy-dom
/**
 * The guided report composer: for a chosen report type it opens expanded with
 * the notice and rules above the fields, hides the board line, and holds Submit
 * until the rules are acknowledged (only when the type has rules).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlProvider } from 'react-intl'

const { createPost, viewer } = vi.hoisted(() => ({
  createPost: vi.fn(),
  viewer: { session: { user: { name: 'Sam', email: 's@x.io', principalType: 'user' } } as unknown },
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn(), navigate: vi.fn() }),
  useRouteContext: (opts?: { select?: (context: never) => unknown }) => {
    const context = { session: viewer.session }
    return opts?.select ? opts.select(context as never) : context
  },
  Link: ({ children }: { children: ReactNode }) => <a href="/reports">{children}</a>,
}))
vi.mock('@/lib/client/hooks/use-image-upload', () => ({
  usePortalMediaUpload: () => ({ upload: vi.fn() }),
}))
vi.mock('@/lib/client/mutations/portal-posts', () => ({
  useCreatePublicPost: () => ({ mutateAsync: createPost, isPending: false }),
}))
vi.mock('@/components/auth/auth-popover-context', () => ({
  useAuthPopover: () => ({ openAuthPopover: vi.fn() }),
}))
vi.mock('@/lib/client/hooks/use-auth-broadcast', () => ({ useAuthBroadcast: () => {} }))
vi.mock('@/lib/client/hooks/use-similar-posts', () => ({
  useSimilarPosts: () => ({ posts: [] }),
}))
vi.mock('@/lib/client/hooks/use-ensure-anon-session', () => ({
  useEnsureAnonSession: () => async () => true,
}))
vi.mock('@/lib/client/auth-client', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/client/queries/portal', () => ({ removeViewerScopedPortalQueries: vi.fn() }))
vi.mock('@/components/public/similar-posts-card', () => ({ SimilarPostsCard: () => null }))
vi.mock('@/components/public/feedback/posting-to-board', () => ({
  PostingToBoard: () => <div data-testid="posting-to-board" />,
}))
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react')
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout'])
  const make = (tag: string) =>
    forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
      const { children, ...rest } = props
      const dom: Record<string, unknown> = { ref }
      for (const [key, value] of Object.entries(rest)) {
        if (!MOTION_PROPS.has(key)) dom[key] = value
      }
      return createElement(tag, dom, children as ReactNode)
    })
  const proxy = new Proxy(
    {},
    { get: (_target, prop) => (typeof prop === 'string' ? make(prop) : undefined) }
  )
  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
    motion: proxy,
    m: proxy,
  }
})
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => <div data-testid="editor" />,
}))

import { FeedbackHeaderAnimated } from '../feedback-header-animated'
import type { ReportGuideConfig } from '@/components/public/reports/report-guide'

const BOARD = { id: 'board_1', name: 'Player complaints', slug: 'players' }

function renderComposer(guide?: Partial<ReportGuideConfig>) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <FeedbackHeaderAnimated
          workspaceName="Acme"
          variant="report"
          boards={[BOARD]}
          defaultBoardId={BOARD.id}
          boardLocked
          user={{ name: 'Sam', email: 's@x.io' }}
          boardPermissions={{ [BOARD.id]: { canSubmit: true, canVote: false } }}
          reportGuide={{
            boardId: BOARD.id,
            boardName: BOARD.name,
            isPrivate: false,
            notice: 'Warning text',
            rules: 'Be kind.',
            canChangeType: true,
            changeTypeSearch: {},
            ...guide,
          }}
        />
      </IntlProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  createPost.mockReset()
})

const submit = () => screen.getByRole('button', { name: 'Submit' })

describe('guided report composer', () => {
  it('opens expanded with the notice and rules, and no board picker', () => {
    renderComposer()
    expect(screen.getByTestId('report-notice')).toHaveTextContent('Warning text')
    expect(screen.getByText('Be kind.')).toBeInTheDocument()
    expect(screen.queryByTestId('posting-to-board')).toBeNull()
  })

  it('holds Submit until the rules are acknowledged', () => {
    renderComposer()
    expect(submit()).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(submit()).not.toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(submit()).toBeDisabled()
  })

  it('does not file a report from the keyboard before the rules are acknowledged', async () => {
    renderComposer()
    fireEvent.change(screen.getByRole('textbox', { name: 'Report title' }), {
      target: { value: 'Someone cheated' },
    })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Report title' }), {
      key: 'Enter',
      ctrlKey: true,
    })
    await waitFor(() =>
      expect(
        screen.getByText(/Confirm that you have read the submission rules/)
      ).toBeInTheDocument()
    )
    expect(createPost).not.toHaveBeenCalled()
  })

  it('needs no acknowledgement when the type has no rules', () => {
    renderComposer({ rules: '' })
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(submit()).not.toBeDisabled()
  })

  it('files the report once the rules are acknowledged', async () => {
    createPost.mockResolvedValue({ id: 'post_1', board: { slug: 'players' } })
    renderComposer()
    fireEvent.change(screen.getByRole('textbox', { name: 'Report title' }), {
      target: { value: 'Someone cheated' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(submit())
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1))
    expect(createPost.mock.calls[0][0]).toMatchObject({
      boardId: 'board_1',
      title: 'Someone cheated',
    })
  })
})
