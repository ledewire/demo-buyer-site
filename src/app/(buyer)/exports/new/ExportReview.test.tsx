import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportReview from './ExportReview'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const works = [
  { url: 'https://a.example/1', publicationId: 'p1', publicationName: 'Pub A' },
  { url: 'https://a.example/2', publicationId: 'p1', publicationName: 'Pub A' },
  { url: 'https://b.example/1', publicationId: 'p2', publicationName: 'Pub B' },
]

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

const stored = () => JSON.parse(sessionStorage.getItem('lw_export_selection') ?? '[]')

describe('ExportReview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    push.mockReset()
    sessionStorage.setItem('lw_export_selection', JSON.stringify(works))
  })

  it('shows an empty state with no selection', () => {
    sessionStorage.clear()
    render(<ExportReview />)
    expect(screen.getByText('No articles selected.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse the catalog' })).toHaveAttribute(
      'href',
      '/catalog',
    )
  })

  it('groups works by publication', () => {
    render(<ExportReview />)
    expect(screen.getByRole('heading', { name: /Pub A \(2\)/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Pub B \(1\)/ })).toBeInTheDocument()
  })

  it('removes a work', async () => {
    render(<ExportReview />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove https://b.example/1' }))
    expect(screen.queryByText('https://b.example/1')).not.toBeInTheDocument()
    expect(stored()).toHaveLength(2)
  })

  it('clears all after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ExportReview />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByText('No articles selected.')).toBeInTheDocument()
  })

  it('keeps the selection when clear-all is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ExportReview />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(stored()).toHaveLength(3)
  })

  it('requests a quote, clears the selection and navigates', async () => {
    mockFetch(201, { id: 'acq-1' })
    render(<ExportReview />)
    await userEvent.click(screen.getByRole('button', { name: 'Request quote for 3 articles' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: works.map((w) => w.url) }),
    })
    expect(push).toHaveBeenCalledWith('/exports/acq-1')
    expect(stored()).toEqual([])
  })

  it('shows the API error and keeps the selection', async () => {
    mockFetch(400, { error: 'Every URL must be an http(s) URL' })
    render(<ExportReview />)
    await userEvent.click(screen.getByRole('button', { name: /request quote/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Every URL must be an http(s) URL')
    expect(push).not.toHaveBeenCalled()
    expect(stored()).toHaveLength(3)
  })

  it('shows a network error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('offline'))
    render(<ExportReview />)
    await userEvent.click(screen.getByRole('button', { name: /request quote/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i)
  })
})
