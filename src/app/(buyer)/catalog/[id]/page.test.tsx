import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import PublicationPage from './page'
import { AuthError, LedewireError, NotFoundError } from '@ledewire/node'
import type { Publication } from '@ledewire/node'
import { notFound, redirect } from 'next/navigation'
import { mockPublications } from '@/__mocks__/ledewire-client'

const publication: Publication = {
  id: 'pub-1',
  name: 'The Daily',
  topics: [],
  domains: ['daily.example'],
  bulk_licensable: true,
  coverage_horizon: null,
}

function loadPage(id = 'pub-1') {
  return PublicationPage({ params: Promise.resolve({ id }) })
}

describe('PublicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPublications.get.mockResolvedValue(publication as never)
  })

  it('loads the publication by id and renders it', async () => {
    render(await loadPage('pub-1'))

    expect(mockPublications.get).toHaveBeenCalledWith('pub-1')
    expect(mockPublications.list).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'The Daily' })).toBeInTheDocument()
    expect(screen.getByText('daily.example')).toBeInTheDocument()
  })

  it('renders the Next.js 404 when the publication is not found', async () => {
    mockPublications.get.mockRejectedValue(new NotFoundError('no such publication'))

    await expect(loadPage('missing')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('redirects to /login on AuthError', async () => {
    mockPublications.get.mockRejectedValue(new AuthError('expired'))

    await expect(loadPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('renders an inline message on LedewireError', async () => {
    mockPublications.get.mockRejectedValue(new LedewireError('boom', 500))

    render(await loadPage())

    expect(screen.getByText('API error: boom')).toBeInTheDocument()
  })
})
