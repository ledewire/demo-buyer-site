import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import SearchPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { ContentSearchResponse } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { mockContent } from '@/__mocks__/ledewire-client'

async function renderPage(searchParams: Record<string, string> = {}) {
  return render(await SearchPage({ searchParams: Promise.resolve(searchParams) }))
}

const onePage: ContentSearchResponse = {
  data: [
    {
      id: 'c-1',
      title: 'Ocean heat',
      teaser: 'Oceans are warming.',
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
    },
  ],
  next_cursor: null,
  partial_results: false,
  unavailable_providers: [],
}

const searchButton = () => screen.getByRole('button', { name: 'Search' })

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockContent.search.mockResolvedValue(onePage as never)
  })

  it('requires a signed-in buyer', async () => {
    await renderPage()
    expect(requireAuth).toHaveBeenCalled()
  })

  it('with no query renders the form and searches nothing', async () => {
    await renderPage()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(searchButton()).toBeEnabled()
    expect(mockContent.search).not.toHaveBeenCalled()
  })

  it('searches the query and max price on the server and renders the results', async () => {
    await renderPage({ q: 'x', max_price: '1.50' })
    expect(mockContent.search).toHaveBeenCalledWith({ query: 'x', max_price_cents: 150 })
    expect(screen.getByText('Ocean heat')).toBeInTheDocument()
    expect(screen.getByText('Oceans are warming.')).toBeInTheDocument()
    expect(screen.getByText('$1.25')).toBeInTheDocument()
    expect(screen.getByText('Daily Planet')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('x')
  })

  it('does not search on a max price that is not a dollar amount', async () => {
    await renderPage({ q: 'x', max_price: 'cheap' })
    expect(mockContent.search).not.toHaveBeenCalled()
    expect(screen.getByText('Enter a max price of $0 or more')).toBeInTheDocument()
  })

  it('a 429 on the first page shows the wait in place of the results, and keeps the form', async () => {
    mockContent.search.mockRejectedValue(
      new LedewireError('slow down', 429, undefined, undefined, undefined, 30) as never,
    )
    await renderPage({ q: 'x' })
    expect(screen.getByText('Too many searches — try again in 30 s')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
    expect(searchButton()).toBeDisabled()
    expect(screen.queryByText('Nothing matched')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('a 429 with no usable wait still shows a wait, of a minute', async () => {
    mockContent.search.mockRejectedValue(
      new LedewireError('slow down', 429, undefined, undefined, undefined, 0) as never,
    )
    await renderPage({ q: 'x' })
    expect(screen.getByText('Too many searches — try again in 60 s')).toBeInTheDocument()
  })

  it('shows another API error inline', async () => {
    mockContent.search.mockRejectedValue(new LedewireError('search is down', 503) as never)
    await renderPage({ q: 'x' })
    expect(screen.getByText('API error: search is down')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument()
  })

  it('redirects to sign-in on an AuthError', async () => {
    mockContent.search.mockRejectedValue(new AuthError('expired') as never)
    await expect(renderPage({ q: 'x' })).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows the selection summary', async () => {
    sessionStorage.setItem(
      'lw_export_selection',
      JSON.stringify([{ url: 'https://a.example/1', publicationId: 'p-1', publicationName: 'A' }]),
    )
    await renderPage()
    expect(await screen.findByText(/1 article selected from 1 publication/)).toBeInTheDocument()
  })
})
