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

import WalletPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMembership } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { getCompanyMembership } from '@/lib/company'
import { mockCompany, mockWallet } from '@/__mocks__/ledewire-client'

const adminMembership: CompanyMembership = {
  id: 'mem-1',
  company_id: 'co-1',
  company_name: 'Acme',
  role: 'admin',
  joined_at: '2026-01-01T00:00:00Z',
}

async function renderPage() {
  return render(await WalletPage())
}

describe('WalletPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    mockWallet.balance.mockResolvedValue({
      balance_cents: 2500,
      held_cents: 0,
      remaining_cents: 700,
    } as never)
    mockWallet.transactions.mockResolvedValue({ data: [] } as never)
    mockCompany.wallet.listPendingTopUps.mockResolvedValue({ data: [] } as never)
    mockCompany.purchases.list.mockResolvedValue({ data: [] } as never)
  })

  it('lets a buyer with no Company fund their personal wallet', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Wallet' })).toBeInTheDocument()
    expect(screen.getByText('$25.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fund wallet' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Transaction History' })).toBeInTheDocument()
    expect(screen.getByText('No transactions yet.')).toBeInTheDocument()
  })

  it('shows a non-admin member their headroom and no way to fund the Company wallet', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Company Wallet' })).toBeInTheDocument()
    expect(screen.getByText('$7.00')).toBeInTheDocument()
    expect(screen.getByText('Only Company admins can add funds.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /fund|add funds/i })).not.toBeInTheDocument()
    expect(mockCompany.wallet.listPendingTopUps).not.toHaveBeenCalled()
  })

  it('shows an API error from loading the wallet inline', async () => {
    mockWallet.balance.mockRejectedValue(new LedewireError('service unavailable', 503))
    await renderPage()
    expect(screen.getByText('API error: service unavailable')).toBeInTheDocument()
  })

  it('redirects to login when the session expires while loading the wallet', async () => {
    mockWallet.balance.mockRejectedValue(new AuthError('expired'))
    await expect(WalletPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('sends a Company admin to the Company Wallet page to add funds', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    await renderPage()
    expect(screen.getByText('$7.00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add funds' })).toHaveAttribute(
      'href',
      '/company/wallet',
    )
    expect(screen.queryByRole('button', { name: 'Add funds' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pending top-ups' })).not.toBeInTheDocument()
    expect(mockCompany.wallet.listPendingTopUps).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Recent Company spending' })).toBeInTheDocument()
  })
})
