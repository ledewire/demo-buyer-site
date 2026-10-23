import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import CatalogPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { Publication, PublicationListResponse } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { mockPublications } from '@/__mocks__/ledewire-client'

function makePublication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'pub-1',
    name: 'The Daily',
    topics: [],
    domains: ['daily.example'],
    bulk_licensable: false,
    coverage_horizon: null,
    ...overrides,
  }
}

function listResponse(
  data: Publication[],
  pagination: Partial<PublicationListResponse['pagination']> = {},
): PublicationListResponse {
  return {
    data,
    pagination: {
      total: data.length,
      per_page: 50,
      current_page: 1,
      total_pages: 1,
      next_page: null,
      prev_page: null,
      ...pagination,
    },
    unclassified_count: 0,
  }
}

async function renderPage(searchParams: Record<string, string> = {}) {
  return render(await CatalogPage({ searchParams: Promise.resolve(searchParams) }))
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPublications.list.mockResolvedValue(listResponse([]) as never)
  })

  it('searches the server with q and bulk_licensable and renders what it returns', async () => {
    mockPublications.list.mockResolvedValue(
      listResponse([
        makePublication({ id: 'pub-9', name: 'Licensable Weekly', bulk_licensable: true }),
      ]) as never,
    )

    await renderPage({ q: 'x', licensable: '1' })

    expect(mockPublications.list).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'x', bulk_licensable: true }),
    )
    expect(screen.getByRole('link', { name: /Licensable Weekly/ })).toHaveAttribute(
      'href',
      '/catalog/pub-9',
    )
  })

  it('leaves bulk_licensable and q unset when no filter is given', async () => {
    await renderPage()

    const params = mockPublications.list.mock.calls[0][0]
    expect(params).not.toHaveProperty('bulk_licensable')
    expect(params).not.toHaveProperty('q')
  })

  it('asks for the requested page, 50 at a time', async () => {
    await renderPage({ page: '3' })

    expect(mockPublications.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, per_page: 50 }),
    )
  })

  it.each(['0', '-2', 'abc', '1.5'])('treats page=%s as page 1', async (page) => {
    await renderPage({ page })

    expect(mockPublications.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 50 }),
    )
  })

  it('treats a missing page as page 1', async () => {
    await renderPage()

    expect(mockPublications.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 50 }),
    )
  })

  it('links Previous and Next with q and licensable kept', async () => {
    mockPublications.list.mockResolvedValue(
      listResponse([makePublication()], {
        current_page: 2,
        total_pages: 3,
        total: 120,
        prev_page: 1,
        next_page: 3,
      }) as never,
    )

    await renderPage({ q: 'news', licensable: '1', page: '2' })

    expect(screen.getByRole('link', { name: /Previous/ })).toHaveAttribute(
      'href',
      '/catalog?q=news&licensable=1&page=1',
    )
    expect(screen.getByRole('link', { name: /Next/ })).toHaveAttribute(
      'href',
      '/catalog?q=news&licensable=1&page=3',
    )
  })

  it('has no Previous link on the first page', async () => {
    mockPublications.list.mockResolvedValue(
      listResponse([makePublication()], { total_pages: 2, total: 60, next_page: 2 }) as never,
    )

    await renderPage()

    expect(screen.queryByRole('link', { name: /Previous/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Next/ })).toHaveAttribute('href', '/catalog?page=2')
  })

  it('has no Next link on the last page', async () => {
    mockPublications.list.mockResolvedValue(
      listResponse([makePublication()], {
        current_page: 2,
        total_pages: 2,
        total: 60,
        prev_page: 1,
      }) as never,
    )

    await renderPage({ page: '2' })

    expect(screen.queryByRole('link', { name: /Next/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Previous/ })).toHaveAttribute(
      'href',
      '/catalog?page=1',
    )
  })

  it('says so when nothing matches', async () => {
    await renderPage({ q: 'zzz' })

    expect(screen.getByText('No publications match.')).toBeInTheDocument()
  })

  it('redirects to /login on AuthError', async () => {
    mockPublications.list.mockRejectedValue(new AuthError('expired'))

    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('renders an inline message on LedewireError', async () => {
    mockPublications.list.mockRejectedValue(new LedewireError('boom', 500))

    await renderPage()

    expect(screen.getByText('API error: boom')).toBeInTheDocument()
  })
})
