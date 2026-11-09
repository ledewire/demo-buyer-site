import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/company', () => ({ getCompanyMembership: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import { redirect } from 'next/navigation'
import { AuthError, ForbiddenError, LedewireError } from '@ledewire/node'
import { getCompanyMembership } from '@/lib/company'
import PurchasesPage from './page'
import { mockPurchases, mockUserPaymentKeys } from '@/__mocks__/ledewire-client'

const purchase = {
  id: 'p-1',
  content_id: 'c-1',
  content: {
    id: 'c-1',
    content_type: 'markdown',
    title: 'Article Title',
    resource_url: null,
    publication: null,
    filing: null,
  },
  buyer_id: 'b-1',
  buyer: { id: 'b-1', name: 'Alice' },
  seller_id: 's-1',
  seller: { id: 's-1', name: 'ACME News' },
  amount_cents: 499,
  timestamp: '2026-01-15T10:00:00Z',
  status: 'completed',
  license: null,
  payment_key_id: 'pk-1',
}

describe('PurchasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    mockPurchases.list.mockResolvedValue([purchase] as never)
    mockUserPaymentKeys.list.mockResolvedValue([
      {
        id: 'pk-1',
        name: 'research-agent',
        public_key: 'A'.repeat(43),
        created_by_user_id: null,
        created_at: '2026-01-01T00:00:00Z',
        last_used_at: null,
      },
    ])
  })

  it('names the Payment key that paid for a purchase', async () => {
    render(await PurchasesPage())
    expect(screen.getByText('via Payment key')).toBeInTheDocument()
    expect(screen.getByText('research-agent')).toBeInTheDocument()
  })

  it.each([
    ['an API error', new LedewireError('Service unavailable', 503)],
    ["a Machine user's refusal", new ForbiddenError('Machine users cannot manage their own keys')],
  ])(
    'still renders the purchases, with no error, when the key list fails with %s',
    async (_label, err) => {
      mockUserPaymentKeys.list.mockRejectedValue(err)
      render(await PurchasesPage())
      expect(screen.getByText('Article Title')).toBeInTheDocument()
      expect(screen.getByText('via a Payment key')).toBeInTheDocument()
      expect(screen.queryByText(/API error/)).not.toBeInTheDocument()
    },
  )

  it('redirects to login when the key list is unauthenticated', async () => {
    mockUserPaymentKeys.list.mockRejectedValue(new AuthError('expired'))
    await expect(PurchasesPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('rethrows an unexpected error from the key list', async () => {
    mockUserPaymentKeys.list.mockRejectedValue(new TypeError('boom'))
    await expect(PurchasesPage()).rejects.toThrow('boom')
  })

  it('redirects to login when the purchases read is unauthenticated', async () => {
    mockPurchases.list.mockRejectedValue(new AuthError('expired'))
    await expect(PurchasesPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows an inline message when the purchases read fails', async () => {
    mockPurchases.list.mockRejectedValue(new LedewireError('Service unavailable', 503))
    render(await PurchasesPage())
    expect(screen.getByText('API error: Service unavailable')).toBeInTheDocument()
  })
})
