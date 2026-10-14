// @vitest-environment happy-dom
/**
 * A report thread is a public record with no public-opinion signal: no
 * reaction picker or chips, and only the team can delete a reply.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlProvider } from 'react-intl'
import type { PublicCommentView } from '@/lib/client/queries/portal-detail'
import type { PostCommentId, PostId, PrincipalId } from '@quackback/ids'

vi.mock('@/components/shared/confirm-dialog', () => ({ ConfirmDialog: () => null }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouteContext: (opts?: { select?: (context: never) => unknown }) => {
    const context = {
      settings: { name: 'Acme', brandingData: { logoUrl: null, name: 'Acme' } },
      session: null,
    }
    return opts?.select ? opts.select(context as never) : context
  },
}))

vi.mock('../comment-form', () => ({ CommentForm: () => null }))

import { CommentThread } from '../comment-thread'

afterEach(cleanup)

const AUTHOR = 'principal_01h00000000000000000000000' as PrincipalId

const comment: PublicCommentView = {
  id: 'comment_a' as PostCommentId,
  content: 'Mine',
  contentJson: null,
  authorName: 'Ada',
  principalId: AUTHOR,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  isRemovedByTeam: false,
  parentId: null,
  isTeamMember: false,
  isEdited: false,
  avatarUrl: null,
  replies: [],
  reactions: [{ emoji: '👍', count: 2, hasReacted: false, reactors: [] }],
}

function renderThread(props: { isReportThread: boolean; isTeamMember?: boolean }) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <IntlProvider locale="en" messages={{}} onError={() => {}}>
        <CommentThread
          postId={'post_01h00000000000000000000000' as PostId}
          comments={[comment]}
          allowCommenting
          user={{ name: 'Ada', email: 'ada@example.com', principalId: AUTHOR }}
          onDeleteComment={vi.fn()}
          {...props}
        />
      </IntlProvider>
    </QueryClientProvider>
  )
}

describe('CommentThread on a report', () => {
  it('shows reactions and the author Delete on a feedback post', () => {
    renderThread({ isReportThread: false })
    expect(screen.getByTestId('add-reaction-button')).toBeTruthy()
    expect(screen.getByText('👍')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('hides the reaction picker, existing reactions and the author Delete', () => {
    renderThread({ isReportThread: true })
    expect(screen.queryByTestId('add-reaction-button')).toBeNull()
    expect(screen.queryByText('👍')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })

  it('keeps Delete for the team', () => {
    renderThread({ isReportThread: true, isTeamMember: true })
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(screen.queryByTestId('add-reaction-button')).toBeNull()
  })
})
