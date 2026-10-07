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
import type { CompanyMembership } from '@ledewire/node'
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

async function renderPage() {
  return render(await CompanyWalletPage())
}

describe('CompanyWalletPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    mockCompany.wallet.listPendingTopUps.mockResolvedValue({ data: [] } as never)
  })

  it('points a buyer in no Company to joining one', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole('link', { name: 'Join a Company' })).toHaveAttribute('href', '/join')
    expect(screen.queryByRole('button', { name: 'Add funds' })).not.toBeInTheDocument()
    expect(mockCompany.wallet.listPendingTopUps).not.toHaveBeenCalled()
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
})
