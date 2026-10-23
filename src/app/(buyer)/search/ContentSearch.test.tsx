import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContentSearchResponse, ContentSearchResultWithPublication } from '@ledewire/node'
import { makeResult, mockFetchOnce, WALLET } from '@/test/search-fixtures'
import ContentSearch from './ContentSearch'

function page(
  data: ContentSearchResultWithPublication[],
  extra: Partial<ContentSearchResponse> = {},
): ContentSearchResponse {
  return { data, next_cursor: null, partial_results: false, unavailable_providers: [], ...extra }
}

function renderSearch(props: Partial<Parameters<typeof ContentSearch>[0]> = {}) {
  return render(<ContentSearch q="ocean" maxPrice="" initialPage={null} {...props} />)
}

const loadMore = () => screen.getByRole('button', { name: 'Load more' })

/** Buys the first "Ocean heat" result and answers the purchase with `delivery`. */
async function buy(user: ReturnType<typeof userEvent.setup>, delivery: object, status = 200) {
  mockFetchOnce(200, WALLET)
  await user.click(screen.getByRole('button', { name: 'Buy Ocean heat' }))
  await screen.findByText('Wallet balance: $10.00')
  mockFetchOnce(status, delivery)
  await user.click(screen.getByRole('button', { name: 'Confirm purchase' }))
}

describe('ContentSearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    global.fetch = vi.fn()
    // Leaving a bought article asks first; these flows accept.
    vi.spyOn(window, 'confirm').mockReturnValue(true)
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

  it('another API error on Load more reads as it does on the first page, keeping the results', async () => {
    renderSearch({ initialPage: page([makeResult()], { next_cursor: 'cur-1' }) })
    mockFetchOnce(503, { error: 'search is down' })
    await userEvent.click(loadMore())
    expect(await screen.findByRole('alert')).toHaveTextContent(/^API error: search is down$/)
    expect(screen.getByText('Ocean heat')).toBeInTheDocument()
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

  describe('buying a result', () => {
    it('shows Buy on every result and no Open or bought-before state', () => {
      renderSearch({ initialPage: page([makeResult(), makeResult({ id: 'c-2', title: 'Coral' })]) })
      expect(screen.getAllByRole('button', { name: /^Buy/ })).toHaveLength(2)
      expect(screen.queryByRole('link', { name: /open/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/purchased|bought|owned/i)).not.toBeInTheDocument()
    })

    it('Buy opens a confirmation for that result; Cancel closes it and buys nothing', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      mockFetchOnce(200, WALLET)
      await user.click(screen.getByRole('button', { name: 'Buy Ocean heat' }))
      expect(screen.getByRole('dialog')).toHaveTextContent('Buy Ocean heat?')
      await screen.findByText('Wallet balance: $10.00')

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('confirming buys the work and replaces the results with the article', async () => {
      const user = userEvent.setup()
      renderSearch({
        initialPage: page([makeResult(), makeResult({ id: 'c-2', title: 'Coral' })]),
      })
      await buy(user, { content_type: 'markdown', content_body: '## Warming seas' })
      expect(await screen.findByRole('heading', { name: 'Warming seas' })).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText('Coral')).not.toBeInTheDocument()
    })

    it('guards leaving only while the article is on screen', async () => {
      const user = userEvent.setup()
      const add = vi.spyOn(window, 'addEventListener')
      const remove = vi.spyOn(window, 'removeEventListener')
      renderSearch({ initialPage: page([makeResult()]) })
      expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)

      await buy(user, { content_type: 'markdown', content_body: 'Hot seas.' })
      await screen.findByText('Hot seas.')
      const registered = add.mock.calls.filter(([type]) => type === 'beforeunload')
      expect(registered).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: '← Back to results' }))
      expect(remove).toHaveBeenCalledWith('beforeunload', registered[0][1])
    })

    it('Back to results restores the loaded results and cursor without searching again', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()], { next_cursor: 'cur-2' }) })
      mockFetchOnce(
        200,
        page([makeResult({ id: 'c-2', title: 'Coral' })], { next_cursor: 'cur-3' }),
      )
      await user.click(loadMore())
      await screen.findByText('Coral')

      await buy(user, { content_type: 'markdown', content_body: 'Hot seas.' })
      await screen.findByText('Hot seas.')
      await user.click(screen.getByRole('button', { name: '← Back to results' }))

      expect(screen.getByText('Ocean heat')).toBeInTheDocument()
      expect(screen.getByText('Coral')).toBeInTheDocument()
      expect(screen.queryByText('Hot seas.')).not.toBeInTheDocument()
      const searches = () =>
        vi.mocked(global.fetch).mock.calls.filter(([url]) => String(url).startsWith('/api/search'))
      expect(searches()).toHaveLength(1)

      // The cursor survived too: Load more carries on from where it was.
      mockFetchOnce(200, page([makeResult({ id: 'c-3', title: 'Kelp' })]))
      await user.click(loadMore())
      await screen.findByText('Kelp')
      expect(searches()[1][0]).toBe('/api/search?q=ocean&cursor=cur-3')
    })

    it('a refused buy keeps the results under the confirmation', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      await buy(user, { error: 'Insufficient funds', type: 'insufficient_funds' }, 422)
      expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient funds')
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Ocean heat')).toBeInTheDocument()
    })

    it('writes nothing about the delivered body to localStorage or sessionStorage', async () => {
      const user = userEvent.setup()
      localStorage.clear()
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      renderSearch({ initialPage: page([makeResult()]) })
      await buy(user, { content_type: 'markdown', content_body: 'Secret seas.' })
      await screen.findByText('Secret seas.')
      await user.click(screen.getByRole('button', { name: '← Back to results' }))

      const stored = [localStorage, sessionStorage].flatMap((s) =>
        Object.keys(s).map((k) => s.getItem(k) ?? ''),
      )
      expect(stored.some((v) => v.includes('Secret seas.'))).toBe(false)
      expect(setItem.mock.calls.some(([, v]) => String(v).includes('Secret seas.'))).toBe(false)
    })
  })
})
