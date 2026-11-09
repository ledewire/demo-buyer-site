import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import { redirect } from 'next/navigation'
import { AuthError, LedewireError } from '@ledewire/node'
import ApiKeysPage from './page'
import { mockUserApiKeys, mockUserSpendCap } from '@/__mocks__/ledewire-client'

describe('ApiKeysPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserApiKeys.list.mockResolvedValue([])
    mockUserSpendCap.get.mockResolvedValue({
      cap_cents: 1500,
      spend_window_timezone: 'UTC',
      spent_cents: 0,
      remaining_cents: 1500,
      resets_at: '2026-11-09T00:00:00Z',
      bulk_exempt: false,
      company_name: null,
    })
  })

  it("shows the Buyer's daily agent budget read from the spend cap", async () => {
    render(await ApiKeysPage())
    expect(screen.getByRole('heading', { name: /daily agent budget/i })).toBeInTheDocument()
    expect(screen.getByText('$15.00')).toBeInTheDocument()
    expect(mockUserSpendCap.get).toHaveBeenCalled()
  })

  it('redirects to login when the spend cap read is unauthenticated', async () => {
    mockUserSpendCap.get.mockRejectedValue(new AuthError('expired'))
    await expect(ApiKeysPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows an inline message when the spend cap read fails', async () => {
    mockUserSpendCap.get.mockRejectedValue(new LedewireError('Service unavailable', 503))
    render(await ApiKeysPage())
    expect(screen.getByText('API error: Service unavailable')).toBeInTheDocument()
  })
})
