import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import CatalogPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { Publication, PublicationListResponse, TopicDirectoryResponse } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { mockPublications, mockTopics } from '@/__mocks__/ledewire-client'

function makePublication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'pub-1',
    name: 'The Daily',
    topics: [],
    domains: ['daily.example'],
    homepage: null,
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

const topicDirectory: TopicDirectoryResponse = {
  data: [
    {
      slug: 'business-and-finance',
      iab_id: '52',
      name: 'Business and Finance',
      publication_count: 190,
    },
    { slug: 'sports', iab_id: '483', name: 'Sports', publication_count: 374 },
  ],
  iab_version: '3.1',
  unclassified_count: 583,
}

async function renderPage(searchParams: Record<string, string> = {}) {
  return render(await CatalogPage({ searchParams: Promise.resolve(searchParams) }))
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPublications.list.mockResolvedValue(listResponse([]) as never)
    mockTopics.list.mockResolvedValue(topicDirectory as never)
  })

  it('narrows the server search to the topic in the URL', async () => {
    await renderPage({ topic: 'sports' })

    expect(mockPublications.list).toHaveBeenCalledWith(
      expect.objectContaining({ topics: ['sports'] }),
    )
  })

  it.each<Record<string, string>>([{}, { topic: 'gardening' }])(
    'sends no topics for %j',
    async (searchParams) => {
      await renderPage(searchParams)

      expect(mockPublications.list.mock.calls[0][0]).not.toHaveProperty('topics')
    },
  )

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

  it("shows each publication's topics as labelled pills", async () => {
    mockPublications.list.mockResolvedValue(
      listResponse([
        makePublication({ id: 'pub-1', topics: ['business-and-finance', 'food-and-drink'] }),
        makePublication({ id: 'pub-2', name: 'Unclassified Times', topics: [] }),
      ]) as never,
    )

    await renderPage()

    const classified = screen.getByRole('link', { name: /The Daily/ })
    const topics = within(classified).getByRole('list', { name: 'Topics' })
    expect(
      within(topics)
        .getAllByRole('listitem')
        .map((el) => el.textContent),
    ).toEqual(['Business and finance', 'Food and drink'])
    const unclassified = screen.getByRole('link', { name: /Unclassified Times/ })
    expect(within(unclassified).queryByRole('list', { name: 'Topics' })).not.toBeInTheDocument()
  })

  it('offers every directory topic with its publication count, selecting the one in the URL', async () => {
    await renderPage({ topic: 'sports' })

    const select = screen.getByRole('combobox', { name: 'Topic' })
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => [(o as HTMLOptionElement).value, o.textContent]),
    ).toEqual([
      ['', 'All topics'],
      ['business-and-finance', 'Business and finance (190)'],
      ['sports', 'Sports (374)'],
    ])
    expect(select).toHaveValue('sports')
  })

  it('defaults the topic select to All topics', async () => {
    await renderPage({ topic: 'gardening' })

    expect(screen.getByRole('combobox', { name: 'Topic' })).toHaveValue('')
  })

  it('still lists publications and offers every topic, without counts, when the topic directory fails', async () => {
    const directoryError = new TypeError('fetch failed')
    mockTopics.list.mockRejectedValue(directoryError)
    mockPublications.list.mockResolvedValue(listResponse([makePublication()]) as never)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await renderPage({ topic: 'war-and-conflicts' })

    expect(consoleError).toHaveBeenCalledWith(
      '[catalog] Topic directory read failed',
      directoryError,
    )
    consoleError.mockRestore()

    expect(screen.getByRole('link', { name: /The Daily/ })).toBeInTheDocument()
    const select = screen.getByRole('combobox', { name: 'Topic' })
    const options = within(select).getAllByRole('option')
    expect(options).toHaveLength(36)
    expect(options[1]).toHaveTextContent(/^Attractions$/)
    expect(options[35]).toHaveTextContent(/^War and conflicts$/)
    expect(select).toHaveValue('war-and-conflicts')
  })

  it('notes that unclassified publications are left out of a topic-filtered list', async () => {
    mockPublications.list.mockResolvedValue({
      ...listResponse([makePublication()]),
      unclassified_count: 583,
    } as never)

    await renderPage({ topic: 'sports' })

    expect(
      screen.getByText(/no topics yet never match a topic filter \(583 in the catalog\)/),
    ).toBeInTheDocument()
  })

  it.each([
    ['no topic is selected', {}, 583],
    ['every publication is classified', { topic: 'sports' }, 0],
  ])('has no unclassified note when %s', async (_, searchParams, unclassified_count) => {
    mockPublications.list.mockResolvedValue({
      ...listResponse([makePublication()]),
      unclassified_count,
    } as never)

    await renderPage(searchParams)

    expect(screen.queryByText(/no topics yet/)).not.toBeInTheDocument()
  })

  it('submits the search form without a page, so a changed filter starts at page 1', async () => {
    await renderPage({ topic: 'sports', page: '3' })

    const form = screen.getByRole('combobox', { name: 'Topic' }).closest('form')!
    expect(form).toHaveAttribute('method', 'get')
    expect(form.querySelector('[name="page"]')).toBeNull()
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
