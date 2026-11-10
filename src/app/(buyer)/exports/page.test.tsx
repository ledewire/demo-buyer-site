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
import { AuthError, LedewireError, type CompanyMembership } from '@ledewire/node'
import { getCompanyMembership } from '@/lib/company'
import ExportsPage from './page'
import { mockCompany, mockWallet } from '@/__mocks__/ledewire-client'

const membership: CompanyMembership = {
  id: 'mem-1',
  company_id: 'co-1',
  company_name: 'Acme',
  role: 'admin',
  joined_at: '2026-01-01T00:00:00Z',
}

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

  it("tells a Company member that the Company's exports are listed for its admins", async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...membership, role: 'member' })
    render(await ExportsPage())
    expect(screen.getByText(/listed for its admins/)).toBeInTheDocument()
    expect(mockCompany.purchases.list).not.toHaveBeenCalled()
  })

  it("shows a Company admin the Company's bulk exports", async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(membership)
    mockCompany.purchases.list.mockResolvedValue({ data: [] } as never)
    render(await ExportsPage())
    expect(screen.getByRole('heading', { name: 'Acme exports' })).toBeInTheDocument()
    expect(screen.getByText('Your Company has no exports yet.')).toBeInTheDocument()
    expect(mockCompany.purchases.list).toHaveBeenCalledWith({
      kind: 'bulk_acquisition',
      per_page: 100,
    })
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
