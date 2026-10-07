import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/company', () => ({ getCompanyMembership: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import CompanyWalletPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMembership, CompanyWallet } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getCompanyMembership } from '@/lib/company'
import { mockCompany } from '@/__mocks__/ledewire-client'

const adminMembership: CompanyMembership = {
  id: 'mem-1',
  company_id: 'co-1',
  company_name: 'Acme',
  role: 'admin',
  joined_at: '2026-01-01T00:00:00Z',
}

const companyWallet: CompanyWallet = {
  balance_cents: 123456,
  held_cents: 0,
  pending_top_up_cents: 0,
  currency: 'usd',
  company_name: 'Acme',
}

async function renderPage() {
  return render(await CompanyWalletPage())
}

describe('CompanyWalletPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    mockCompany.wallet.listPendingTopUps.mockResolvedValue({ data: [] } as never)
    mockCompany.wallet.get.mockResolvedValue(companyWallet)
  })

  it('points a buyer in no Company to joining one', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole('link', { name: 'Join a Company' })).toHaveAttribute('href', '/join')
    expect(screen.queryByRole('button', { name: 'Add funds' })).not.toBeInTheDocument()
    expect(mockCompany.wallet.listPendingTopUps).not.toHaveBeenCalled()
    expect(mockCompany.wallet.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Company balance' })).not.toBeInTheDocument()
  })

  it('tells a non-admin member that only admins can manage the Company wallet', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(
      screen.getByText('Only Company admins can manage the Company wallet.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add funds' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument()
    expect(mockCompany.wallet.listPendingTopUps).not.toHaveBeenCalled()
    expect(mockCompany.wallet.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Company balance' })).not.toBeInTheDocument()
  })

  it('requires a signed-in buyer', async () => {
    await renderPage()
    expect(requireAuth).toHaveBeenCalled()
  })

  it('redirects to login when the session has expired', async () => {
    vi.mocked(getCompanyMembership).mockRejectedValue(new AuthError('expired'))
    await expect(CompanyWalletPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows the API error inline', async () => {
    mockCompany.wallet.listPendingTopUps.mockRejectedValue(
      new LedewireError('service unavailable', 503),
    )
    await renderPage()
    expect(screen.getByText('API error: service unavailable')).toBeInTheDocument()
  })

  it('shows the Company tabs with Wallet current', async () => {
    await renderPage()
    const tabs = screen.getByRole('navigation', { name: 'Company' })
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['People', 'Machines', 'Purchases', 'Wallet'])
    const wallet = within(tabs).getByRole('link', { name: 'Wallet' })
    expect(wallet).toHaveAttribute('href', '/company/wallet')
    expect(wallet).toHaveAttribute('aria-current', 'page')
  })

  it("lets an admin add funds and see the Company's pending top-ups", async () => {
    mockCompany.wallet.listPendingTopUps.mockResolvedValue({
      data: [
        {
          id: 'tu-1',
          session_id: 'cs_1',
          amount_cents: 50000,
          status: 'processing',
          created_at: '2026-10-01T00:00:00Z',
          expected_debit_date: '2026-10-05',
        },
      ],
    } as never)
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Company Wallet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add funds' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pending top-ups' })).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
  })

  it('shows an admin the Company balance as the Available figure', async () => {
    await renderPage()
    const card = screen.getByRole('region', { name: 'Company balance' })
    expect(within(card).getByText('Available')).toBeInTheDocument()
    expect(within(card).getByText('$1234.56')).toBeInTheDocument()
  })

  it('shows the balance next to Add funds', async () => {
    await renderPage()
    const row = screen.getByRole('region', { name: 'Company balance' }).parentElement!
    expect(within(row).getByRole('button', { name: 'Add funds' })).toBeInTheDocument()
    expect(within(row).queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows money held for bulk exports when some is held', async () => {
    mockCompany.wallet.get.mockResolvedValue({ ...companyWallet, held_cents: 2500 })
    await renderPage()
    const card = screen.getByRole('region', { name: 'Company balance' })
    expect(within(card).getByText('$25.00 held for bulk exports in progress')).toBeInTheDocument()
  })

  it('shows no held line when nothing is held', async () => {
    await renderPage()
    const card = screen.getByRole('region', { name: 'Company balance' })
    expect(within(card).queryByText(/held for bulk exports/)).not.toBeInTheDocument()
  })

  it('points at the pending top-ups when money is on its way', async () => {
    mockCompany.wallet.get.mockResolvedValue({ ...companyWallet, pending_top_up_cents: 50000 })
    await renderPage()
    const card = screen.getByRole('region', { name: 'Company balance' })
    expect(
      within(card).getByText('$500.00 on its way — see Pending top-ups below'),
    ).toBeInTheDocument()
  })

  it('shows no on-its-way line when no top-up is pending', async () => {
    await renderPage()
    const card = screen.getByRole('region', { name: 'Company balance' })
    expect(within(card).queryByText(/on its way/)).not.toBeInTheDocument()
  })

  it('keeps Add funds and Pending top-ups when the balance cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockCompany.wallet.get.mockRejectedValue(new LedewireError('service unavailable', 503))
    await renderPage()
    expect(screen.getByText('Balance unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Company balance' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add funds' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pending top-ups' })).toBeInTheDocument()
  })

  it('still redirects to login when the balance read finds the session expired', async () => {
    mockCompany.wallet.get.mockRejectedValue(new AuthError('expired'))
    await expect(CompanyWalletPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
