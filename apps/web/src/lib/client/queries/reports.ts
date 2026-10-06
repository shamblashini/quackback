import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  fetchHasReportBoardsFn,
  fetchReportsPageFn,
  type ReportsPageData,
} from '@/lib/server/functions/reports'

export interface ReportsListParams {
  status?: string
  search?: string
}

export const reportsQueries = {
  /** Report boards + the first page of reports, for the loader and composer. */
  page: (params: ReportsListParams) =>
    queryOptions({
      queryKey: ['portal', 'reports', 'page', params.status ?? null, params.search ?? null],
      queryFn: () => fetchReportsPageFn({ data: { ...params, page: 1 } }),
    }),

  /** The report list, paged for "Load more". */
  list: (params: ReportsListParams) =>
    infiniteQueryOptions({
      queryKey: ['portal', 'reports', 'list', params.status ?? null, params.search ?? null],
      initialPageParam: 1,
      queryFn: ({ pageParam }): Promise<ReportsPageData> =>
        fetchReportsPageFn({ data: { ...params, page: pageParam } }),
      getNextPageParam: (last, pages) => (last.reports.hasMore ? pages.length + 1 : undefined),
    }),

  /** Whether the viewer can see any report board (gates the nav tab). */
  hasReportBoards: () =>
    queryOptions({
      queryKey: ['portal', 'reports', 'has-boards'],
      queryFn: () => fetchHasReportBoardsFn(),
      staleTime: 5 * 60 * 1000,
    }),
}
