import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContentSearchResponse, ContentSearchResultWithPublication } from '@ledewire/node'
import ContentSearch from './ContentSearch'

function makeResult(
  overrides: Partial<ContentSearchResultWithPublication> = {},
): ContentSearchResultWithPublication {
  return {
    id: 'c-1',
    title: 'Ocean heat',
    teaser: 'Oceans are warming faster than expected.',
    price_cents: 125,
    content_type: 'markdown',
    store_id: 's-1',
    store_name: 'Daily Planet',
    tags: [],
    url: null,
    authors: null,
    abstract: null,
    doi: null,
    publication_date: null,
    last_modified_date: null,
    citation_count: null,
    publication: null,
    ...overrides,
  }
}

function page(
  data: ContentSearchResultWithPublication[],
  extra: Partial<ContentSearchResponse> = {},
): ContentSearchResponse {
  return { data, next_cursor: null, partial_results: false, unavailable_providers: [], ...extra }
}

function mockFetchOnce(status: number, body: object, headers: Record<string, string> = {}) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as Response)
}

function renderSearch(props: Partial<Parameters<typeof ContentSearch>[0]> = {}) {
  return render(<ContentSearch q="ocean" maxPrice="" initialPage={null} {...props} />)
}

const loadMore = () => screen.getByRole('button', { name: 'Load more' })

describe('ContentSearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows each result’s title, teaser, price and store, and no result count', () => {
    renderSearch({
      initialPage: page([
        makeResult(),
        makeResult({ id: 'c-2', title: 'Coral', teaser: 'Reefs.', price_cents: 50 }),
      ]),
    })
    expect(screen.getByText('Ocean heat')).toBeInTheDocument()
    expect(screen.getByText('Oceans are warming faster than expected.')).toBeInTheDocument()
    expect(screen.getByText('$1.25')).toBeInTheDocument()
    expect(screen.getAllByText('Daily Planet')).toHaveLength(2)
    expect(screen.getByText('Coral')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ results?/i)).not.toBeInTheDocument()
  })

  it('Load more fetches the next page with the same filters and appends it', async () => {
    renderSearch({
      q: 'ocean',
      maxPrice: '1.50',
      initialPage: page([makeResult()], { next_cursor: 'cur-1' }),
    })
    mockFetchOnce(200, page([makeResult({ id: 'c-2', title: 'Coral', teaser: 'Reefs.' })]))
    await userEvent.click(loadMore())
    expect(await screen.findByText('Coral')).toBeInTheDocument()
    expect(screen.getByText('Ocean heat')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/search?q=ocean&max_price=1.50&cursor=cur-1')
    // The second page had no next_cursor: nothing more to load.
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('renders no Load more when the first page has no next_cursor', () => {
    renderSearch({ initialPage: page([makeResult()]) })
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('notes partial results and keeps Load more, which re-asks for the missed part', async () => {
    renderSearch({
      initialPage: page([makeResult()], {
        partial_results: true,
        next_cursor: 'cur-1',
        unavailable_providers: ['ignored-provider'],
      }),
    })
    expect(
      screen.getByText("Some sources couldn't be searched, so these results may be incomplete"),
    ).toBeInTheDocument()
    expect(loadMore()).toBeEnabled()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/ignored-provider/)).not.toBeInTheDocument()

    mockFetchOnce(200, page([makeResult({ id: 'c-2', title: 'Coral', teaser: 'Reefs.' })]))
    await userEvent.click(loadMore())
    await screen.findByText('Coral')
    expect(screen.queryByText(/couldn't be searched/)).not.toBeInTheDocument()
  })

  it('says "Nothing matched" for an empty last page with nothing missed', () => {
    renderSearch({ initialPage: page([]) })
    expect(screen.getByText('Nothing matched')).toBeInTheDocument()
  })

  it('does not say "Nothing matched" when the empty page missed a source', () => {
    renderSearch({ initialPage: page([], { partial_results: true }) })
    expect(screen.queryByText('Nothing matched')).not.toBeInTheDocument()
  })

  it('does not say "Nothing matched" before anything is searched', () => {
    renderSearch({ q: '', initialPage: null })
    expect(screen.queryByText('Nothing matched')).not.toBeInTheDocument()
  })

  it('an empty page with more to search says "No matches yet" and waits for Load more', async () => {
    renderSearch({ initialPage: page([], { next_cursor: 'cur-1' }) })
    expect(screen.getByText('No matches yet — Load more to keep searching')).toBeInTheDocument()
    expect(screen.queryByText('Nothing matched')).not.toBeInTheDocument()
    expect(loadMore()).toBeEnabled()
    // Never followed on its own: each search uses up the buyer's rate limit.
    await act(async () => {})
    expect(global.fetch).not.toHaveBeenCalled()

    mockFetchOnce(200, page([makeResult()]))
    await userEvent.click(loadMore())
    await screen.findByText('Ocean heat')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/No matches yet/)).not.toBeInTheDocument()
  })

  it('a 429 on Load more counts down from Retry-After, disabling Load more and Search', async () => {
    vi.useFakeTimers()
    renderSearch({ initialPage: page([makeResult()], { next_cursor: 'cur-1' }) })
    mockFetchOnce(429, { error: 'slow down' }, { 'Retry-After': '3' })
    await act(async () => {
      fireEvent.click(loadMore())
    })

    expect(screen.getByText('Too many searches — try again in 3 s')).toBeInTheDocument()
    expect(loadMore()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    // The search box stays usable.
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeEnabled()
    expect(screen.getByText('Ocean heat')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Too many searches — try again in 2 s')).toBeInTheDocument()
    expect(loadMore()).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText(/Too many searches/)).not.toBeInTheDocument()
    expect(loadMore()).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  })

  it('a 429 on the server-rendered first page counts down the same way', async () => {
    vi.useFakeTimers()
    renderSearch({ initialPage: null, initialRetryAfter: 2 })
    expect(screen.getByText('Too many searches — try again in 2 s')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText(/Too many searches/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeEnabled()
  })

  it('a 422 on Load more says the search expired and resets to page one', async () => {
    renderSearch({ initialPage: page([makeResult()], { next_cursor: 'stale' }) })
    mockFetchOnce(422, { error: 'cursor expired' })
    await userEvent.click(loadMore())

    expect(await screen.findByText('This search expired — search again')).toBeInTheDocument()
    // The stale cursor is dropped with the results it paged through.
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ocean heat')).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing matched')).not.toBeInTheDocument()

    // Searching again submits only the query and max price: page one, no cursor.
    const form = screen.getByRole('button', { name: 'Search' }).closest('form')!
    expect(form).toHaveAttribute('method', 'get')
    expect(form).toHaveAttribute('action', '/search')
    expect([...new FormData(form).keys()]).toEqual(['q', 'max_price'])
  })

  it('focuses the search box on open', () => {
    renderSearch({ q: '', initialPage: null })
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus()
  })

  it('does not repeat a row a later page sends again', async () => {
    renderSearch({
      initialPage: page([makeResult()], { next_cursor: 'cur-1', partial_results: true }),
    })
    mockFetchOnce(
      200,
      page([makeResult(), makeResult({ id: 'c-2', title: 'Coral', teaser: 'Reefs.' })]),
    )
    await userEvent.click(loadMore())
    await screen.findByText('Coral')
    expect(screen.getAllByText('Ocean heat')).toHaveLength(1)
  })
})
