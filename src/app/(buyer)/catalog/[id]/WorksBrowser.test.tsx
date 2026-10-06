import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorksBrowser from './WorksBrowser'

function page(works: { url: string; last_mod: string | null }[], extra = {}) {
  return {
    publication_id: 'pub-1',
    domain: 'a.example',
    date_filter: 'applied',
    works,
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
