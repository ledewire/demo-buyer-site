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
import { AuthError, LedewireError } from '@ledewire/node'
import { getCompanyMembership } from '@/lib/company'
import ExportsPage from './page'
import { mockWallet } from '@/__mocks__/ledewire-client'

describe('ExportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    mockWallet.transactions.mockResolvedValue({ data: [] } as never)
  })

  it('lists no exports for a Buyer with none', async () => {
    render(await ExportsPage())
    expect(screen.getByRole('heading', { name: 'Exports' })).toBeInTheDocument()
    expect(screen.getByText('No exports yet.')).toBeInTheDocument()
  })

  it('redirects to login when the wallet read is unauthenticated', async () => {
    mockWallet.transactions.mockRejectedValue(new AuthError('expired'))
    await expect(ExportsPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows the API error when the wallet read fails', async () => {
    mockWallet.transactions.mockRejectedValue(new LedewireError('Service unavailable', 503))
    render(await ExportsPage())
    expect(screen.getByText('API error: Service unavailable')).toBeInTheDocument()
  })

  it('rethrows an unexpected error', async () => {
    mockWallet.transactions.mockRejectedValue(new TypeError('boom'))
    await expect(ExportsPage()).rejects.toThrow('boom')
    expect(redirect).not.toHaveBeenCalled()
  })
})
