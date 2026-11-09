import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PublicationWork } from '@ledewire/node'
import WorksBrowser from './WorksBrowser'

type WorkFixture = { url: string; last_mod: string | null } & Partial<PublicationWork>

function page(works: WorkFixture[], extra = {}) {
  return {
    publication_id: 'pub-1',
    domain: 'a.example',
    date_filter: 'applied',
    works: works.map((w) => ({
      page_kind: 'article',
      page_kind_basis: 'rule',
      topics: [],
      topics_basis: 'inherited',
      ...w,
    })),
    next_cursor: null,
    ...extra,
  }
}

function mockFetchOnce(status: number, body: object) {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

function renderBrowser(bulkLicensable = true) {
  return render(
    <WorksBrowser
      publicationId="pub-1"
      publicationName="Pub One"
      bulkLicensable={bulkLicensable}
    />,
  )
}

const stored = () => JSON.parse(sessionStorage.getItem('lw_export_selection') ?? '[]')

describe('WorksBrowser', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    global.fetch = vi.fn()
  })

  it('searches with the date range and lists works', async () => {
    mockFetchOnce(200, page([{ url: 'https://a.example/1', last_mod: '2026-01-05T00:00:00Z' }]))
    renderBrowser()
    await userEvent.type(screen.getByLabelText('From'), '2026-01-01')
    await userEvent.type(screen.getByLabelText('To'), '2026-01-31')
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    expect(await screen.findByText('https://a.example/1')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/publications/pub-1/works?from=2026-01-01&to=2026-01-31',
    )
  })

  it("shows each work's page kind and topics as readable labels", async () => {
    mockFetchOnce(
      200,
      page([
        {
          url: 'https://a.example/1',
          last_mod: null,
          page_kind: 'section_index',
          topics: ['sports', 'books-and-literature'],
        },
      ]),
    )
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    const row = (await screen.findByText('https://a.example/1')).closest('tr')!
    expect(within(row).getByText('Section index')).toBeInTheDocument()
    expect(within(row).getByText('Sports')).toBeInTheDocument()
    expect(within(row).getByText('Books and literature')).toBeInTheDocument()
  })

  it('searches with the chosen page kind', async () => {
    mockFetchOnce(200, page([{ url: 'https://a.example/1', last_mod: null }]))
    renderBrowser()
    await userEvent.selectOptions(screen.getByLabelText('Page kind'), 'Article')
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await screen.findByText('https://a.example/1')
    expect(global.fetch).toHaveBeenCalledWith('/api/publications/pub-1/works?page_kind=article')
  })

  it('changing the page kind after a search reloads from the first page', async () => {
    mockFetchOnce(
      200,
      page([{ url: 'https://a.example/1', last_mod: null }], { next_cursor: 'c2' }),
    )
    mockFetchOnce(
      200,
      page([{ url: 'https://a.example/2', last_mod: null }], { next_cursor: 'c3' }),
    )
    mockFetchOnce(
      200,
      page([{ url: 'https://a.example/9', last_mod: null }], { next_cursor: 'c9' }),
    )
    mockFetchOnce(200, page([{ url: 'https://a.example/10', last_mod: null }]))
    renderBrowser()
    await userEvent.type(screen.getByLabelText('From'), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await screen.findByText('https://a.example/1')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('https://a.example/2')

    await userEvent.selectOptions(screen.getByLabelText('Page kind'), 'Article')

    expect(await screen.findByText('https://a.example/9')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/publications/pub-1/works?from=2026-01-01&page_kind=article',
    )
    expect(screen.queryByText('https://a.example/1')).not.toBeInTheDocument()
    expect(screen.queryByText('https://a.example/2')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('https://a.example/10')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/publications/pub-1/works?from=2026-01-01&page_kind=article&cursor=c9',
    )
  })

  it('locks the page kind while a load is in flight', async () => {
    mockFetchOnce(200, page([{ url: 'https://a.example/1', last_mod: null }]))
    let resolve!: (r: Response) => void
    vi.mocked(global.fetch).mockReturnValueOnce(new Promise((r) => (resolve = r)))
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await screen.findByText('https://a.example/1')

    await userEvent.selectOptions(screen.getByLabelText('Page kind'), 'Article')
    expect(screen.getByLabelText('Page kind')).toBeDisabled()

    resolve({
      ok: true,
      status: 200,
      json: async () => page([{ url: 'https://a.example/9', last_mod: null }]),
    } as Response)
    await screen.findByText('https://a.example/9')
    expect(screen.getByLabelText('Page kind')).toBeEnabled()
  })

  it('puts the page kind back when changing it fails', async () => {
    mockFetchOnce(200, page([{ url: 'https://a.example/1', last_mod: null }]))
    mockFetchOnce(429, { error: 'slow down' })
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await screen.findByText('https://a.example/1')

    await userEvent.selectOptions(screen.getByLabelText('Page kind'), 'Article')

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
    expect(screen.getByLabelText('Page kind')).toHaveValue('')
    expect(screen.getByText('https://a.example/1')).toBeInTheDocument()
  })

  it('says an empty page with more pages behind it is not the end', async () => {
    mockFetchOnce(200, page([], { next_cursor: 'c2' }))
    renderBrowser()
    await userEvent.selectOptions(screen.getByLabelText('Page kind'), 'Media')
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    expect(
      await screen.findByText('No matching articles on this page — load more to keep looking.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('No articles found.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()
  })

  it('selects a single work and all shown works', async () => {
    mockFetchOnce(
      200,
      page([
        { url: 'https://a.example/1', last_mod: null },
        { url: 'https://a.example/2', last_mod: null },
      ]),
    )
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await userEvent.click(await screen.findByLabelText('Select https://a.example/1'))
    expect(stored()).toEqual([
      { url: 'https://a.example/1', publicationId: 'pub-1', publicationName: 'Pub One' },
    ])
    expect(screen.getByRole('link', { name: 'Review export (1)' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Select all shown' }))
    expect(stored()).toHaveLength(2)

    await userEvent.click(screen.getByLabelText('Select https://a.example/1'))
    expect(stored().map((w: { url: string }) => w.url)).toEqual(['https://a.example/2'])
  })

  it('filters shown works by URL', async () => {
    mockFetchOnce(
      200,
      page([
        { url: 'https://a.example/sports/1', last_mod: null },
        { url: 'https://a.example/news/2', last_mod: null },
      ]),
    )
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await screen.findByText('https://a.example/news/2')
    await userEvent.type(screen.getByLabelText('Filter by URL'), 'sports')
    expect(screen.queryByText('https://a.example/news/2')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Select all shown' }))
    expect(stored().map((w: { url: string }) => w.url)).toEqual(['https://a.example/sports/1'])
  })

  it('loads more with the cursor and the original range', async () => {
    mockFetchOnce(
      200,
      page([{ url: 'https://a.example/1', last_mod: null }], { next_cursor: 'c2' }),
    )
    mockFetchOnce(200, page([{ url: 'https://a.example/2', last_mod: null }]))
    renderBrowser()
    await userEvent.type(screen.getByLabelText('From'), '2026-01-01')
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await screen.findByText('https://a.example/1')
    await userEvent.clear(screen.getByLabelText('From'))
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('https://a.example/2')).toBeInTheDocument()
    expect(screen.getByText('https://a.example/1')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/publications/pub-1/works?from=2026-01-01&cursor=c2',
    )
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('notes when the date range is unsupported', async () => {
    mockFetchOnce(200, page([], { date_filter: 'unsupported' }))
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    expect(await screen.findByText(/date range was ignored/i)).toBeInTheDocument()
    expect(screen.getByText('No articles found.')).toBeInTheDocument()
  })

  it('disables selection for publications that are not bulk licensable', async () => {
    mockFetchOnce(200, page([{ url: 'https://a.example/1', last_mod: null }]))
    renderBrowser(false)
    expect(screen.getByText(/isn.t available for bulk licensing/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    expect(await screen.findByLabelText('Select https://a.example/1')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Select all shown' })).not.toBeInTheDocument()
  })

  it('explains rate limiting', async () => {
    mockFetchOnce(429, { error: 'slow down' })
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
  })

  it('shows API errors', async () => {
    mockFetchOnce(400, { error: 'from must be YYYY-MM-DD' })
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('from must be YYYY-MM-DD')
  })

  it('shows a network error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('offline'))
    renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: 'Find articles' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/network error/i))
  })
})
