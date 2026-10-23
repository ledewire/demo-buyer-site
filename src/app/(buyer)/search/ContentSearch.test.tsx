import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContentSearchResponse, ContentSearchResultWithPublication } from '@ledewire/node'
import ExportSelectionSummary from '@/components/ExportSelectionSummary'
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

const WALLET = { balance_cents: 1000, remaining_cents: null, company_name: null }

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

    it('Buy opens a confirmation with the price and wallet balance; Cancel buys nothing', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      mockFetchOnce(200, { balance_cents: 1000, remaining_cents: null, company_name: null })
      await user.click(screen.getByRole('button', { name: 'Buy Ocean heat' }))
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent('$1.25')
      expect(await screen.findByText('Wallet balance: $10.00')).toBeInTheDocument()
      expect(global.fetch).toHaveBeenCalledWith('/api/wallet/balance')

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(global.fetch).not.toHaveBeenCalledWith('/api/purchases', expect.anything())
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('names the Company instead of a balance for a Company member', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      mockFetchOnce(200, { balance_cents: null, remaining_cents: 5000, company_name: 'Acme' })
      await user.click(screen.getByRole('button', { name: 'Buy Ocean heat' }))
      expect(await screen.findByText('Charged to Acme')).toBeInTheDocument()
      expect(screen.queryByText(/Wallet balance/)).not.toBeInTheDocument()
    })

    it('confirming buys the work and replaces the results with the markdown article', async () => {
      const user = userEvent.setup()
      const { container } = renderSearch({
        initialPage: page([makeResult(), makeResult({ id: 'c-2', title: 'Coral' })]),
      })
      await buy(user, {
        content_type: 'markdown',
        content_body:
          '## Warming seas\n\nThe **sea** is hot.\n\n<script>alert(1)</script><b>raw</b>',
      })
      expect(global.fetch).toHaveBeenCalledWith('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: 'c-1' }),
      })
      expect(await screen.findByRole('heading', { name: 'Warming seas' })).toBeInTheDocument()
      expect(screen.getByText('sea').tagName).toBe('STRONG')
      expect(container.querySelector('script')).toBeNull()
      expect(container.querySelector('b')).toBeNull()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText('Coral')).not.toBeInTheDocument()
    })

    it('renders a (server-sanitized) HTML article as HTML', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult({ content_type: 'html' })]) })
      await buy(user, { content_type: 'html', content_body: '<h2>Warming seas</h2><p>Hot.</p>' })
      expect(await screen.findByRole('heading', { name: 'Warming seas' })).toBeInTheDocument()
      expect(screen.getByText('Hot.').tagName).toBe('P')
    })

    it('links Open to content_uri for a work hosted elsewhere', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult({ content_type: 'pdf' })]) })
      await buy(user, { content_type: 'pdf', content_uri: 'https://cdn.example.com/ocean.pdf' })
      const open = await screen.findByRole('link', { name: /Open/ })
      expect(open).toHaveAttribute('href', 'https://cdn.example.com/ocean.pdf')
      expect(open).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('guards leaving while the article is on screen, and Back to results drops the guard', async () => {
      const user = userEvent.setup()
      const add = vi.spyOn(window, 'addEventListener')
      const remove = vi.spyOn(window, 'removeEventListener')
      renderSearch({ initialPage: page([makeResult()]) })
      expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)

      await buy(user, { content_type: 'markdown', content_body: 'Hot seas.' })
      await screen.findByText('Hot seas.')
      const registered = add.mock.calls.filter(([type]) => type === 'beforeunload')
      expect(registered).toHaveLength(1)
      const handler = registered[0][1] as (e: BeforeUnloadEvent) => unknown
      const event = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent
      handler(event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.returnValue).toBe(
        "You won't be able to view this again without buying it again.",
      )

      await user.click(screen.getByRole('button', { name: '← Back to results' }))
      expect(remove).toHaveBeenCalledWith('beforeunload', handler)
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

    it.each([
      [402, { error: 'Daily spend cap reached', type: 'daily_spend_cap_reached' }],
      [422, { error: 'Insufficient funds', type: 'insufficient_funds' }],
    ])('a %i refusal shows its message with a link to /wallet', async (status, body) => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      await buy(user, body, status)
      expect(await screen.findByRole('alert')).toHaveTextContent(body.error)
      expect(screen.getByRole('link', { name: /wallet/i })).toHaveAttribute('href', '/wallet')
      expect(screen.getByText('Ocean heat')).toBeInTheDocument()
    })

    it('another refusal shows its message without a wallet link', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      await buy(user, { error: 'Content not found' }, 404)
      expect(await screen.findByRole('alert')).toHaveTextContent('Content not found')
      expect(screen.queryByRole('link', { name: /wallet/i })).not.toBeInTheDocument()
    })

    it('a network failure says so and buys nothing', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      mockFetchOnce(200, WALLET)
      await user.click(screen.getByRole('button', { name: 'Buy Ocean heat' }))
      vi.mocked(global.fetch).mockRejectedValueOnce(new TypeError('offline'))
      await user.click(screen.getByRole('button', { name: 'Confirm purchase' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Network error')
      expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeEnabled()
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

    it('says so when the balance can’t be loaded', async () => {
      const user = userEvent.setup()
      renderSearch({ initialPage: page([makeResult()]) })
      mockFetchOnce(500, { error: 'boom' })
      await user.click(screen.getByRole('button', { name: 'Buy Ocean heat' }))
      expect(await screen.findByText('Your balance couldn’t be loaded.')).toBeInTheDocument()
    })

    it('renders a brokered body as markdown, raw HTML dropped', async () => {
      const user = userEvent.setup()
      const { container } = renderSearch({
        initialPage: page([makeResult({ content_type: 'brokered' })]),
      })
      await buy(user, { content_type: 'brokered', content_body: '# Abstract\n\n<i>x</i>Plain.' })
      expect(await screen.findByRole('heading', { name: 'Abstract' })).toBeInTheDocument()
      expect(container.querySelector('i')).toBeNull()
    })
  })

  describe('sampling a work for a bulk licence', () => {
    const URL = 'https://inc.com/ocean-heat'
    const PUBLICATION = { id: 'pub-1', name: 'Inc.', bulk_licensable: true, topics: [] }
    const DELIVERY = { content_type: 'brokered', content_body: 'Hot seas.' }

    /** Renders the search with the page's Selection banner, as the search page does. */
    function renderWithSummary(result: ContentSearchResultWithPublication) {
      return render(
        <>
          <ExportSelectionSummary />
          <ContentSearch q="ocean" maxPrice="" initialPage={page([result])} />
        </>,
      )
    }

    it('Add to selection puts the bought work in the Selection, which the banner counts', async () => {
      const user = userEvent.setup()
      renderWithSummary(
        makeResult({ content_type: 'brokered', url: URL, publication: PUBLICATION }),
      )
      await buy(user, DELIVERY)
      await screen.findByText('Hot seas.')
      expect(screen.queryByText(/selected from/)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Add to selection' }))

      expect(JSON.parse(sessionStorage.getItem('lw_export_selection') ?? '[]')).toEqual([
        { url: URL, publicationId: 'pub-1', publicationName: 'Inc.' },
      ])
      expect(screen.getByText('1 article selected from 1 publication')).toBeInTheDocument()
    })

    it('shows the work as added once it is in the Selection', async () => {
      const user = userEvent.setup()
      renderWithSummary(
        makeResult({ content_type: 'brokered', url: URL, publication: PUBLICATION }),
      )
      await buy(user, DELIVERY)
      await user.click(await screen.findByRole('button', { name: 'Add to selection' }))
      expect(screen.getByRole('button', { name: 'Added to selection' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Add to selection' })).not.toBeInTheDocument()
    })

    it('shows a work already in the Selection as added before any click', async () => {
      sessionStorage.setItem(
        'lw_export_selection',
        JSON.stringify([{ url: URL, publicationId: 'pub-1', publicationName: 'Inc.' }]),
      )
      const user = userEvent.setup()
      renderWithSummary(
        makeResult({ content_type: 'brokered', url: URL, publication: PUBLICATION }),
      )
      await buy(user, DELIVERY)
      expect(await screen.findByRole('button', { name: 'Added to selection' })).toBeDisabled()
    })

    it('a result from a Publication that isn’t bulk-licensable links to it but can’t be added', async () => {
      const user = userEvent.setup()
      renderWithSummary(
        makeResult({
          content_type: 'brokered',
          url: URL,
          publication: { ...PUBLICATION, bulk_licensable: false },
        }),
      )
      await buy(user, DELIVERY)
      await screen.findByText('Hot seas.')
      expect(screen.getByRole('link', { name: 'Browse all from Inc.' })).toHaveAttribute(
        'href',
        '/catalog/pub-1',
      )
      expect(screen.queryByRole('button', { name: /to selection/ })).not.toBeInTheDocument()
    })

    it('a bulk-licensable result links to its Publication and says a bulk licence is charged again', async () => {
      const user = userEvent.setup()
      renderWithSummary(
        makeResult({ content_type: 'brokered', url: URL, publication: PUBLICATION }),
      )
      await buy(user, DELIVERY)
      await screen.findByRole('button', { name: 'Add to selection' })
      expect(
        screen.getByText(
          'Licensing this work in bulk is a second delivery, charged separately from this purchase.',
        ),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Browse all from Inc.' })).toHaveAttribute(
        'href',
        '/catalog/pub-1',
      )
    })

    it('a LedeWire-native result offers neither Add to selection nor a Publication to browse', async () => {
      const user = userEvent.setup()
      renderWithSummary(makeResult({ url: 'https://dailyplanet.example/ocean', publication: null }))
      await buy(user, { content_type: 'markdown', content_body: 'Hot seas.' })
      await screen.findByText('Hot seas.')
      expect(screen.queryByRole('button', { name: /to selection/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Browse all/ })).not.toBeInTheDocument()
      expect(screen.queryByText(/second delivery/)).not.toBeInTheDocument()
    })
  })
})
