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

import CompanyPurchasesPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMembership } from '@ledewire/node'
import { redirect } from 'next/navigation'
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
  return render(await CompanyPurchasesPage({ searchParams: Promise.resolve({}) }))
}

describe('CompanyPurchasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    mockCompany.purchases.list.mockResolvedValue({
      data: [],
      pagination: {
        current_page: 1,
        per_page: 25,
        total: 0,
        total_pages: 0,
        next_page: null,
        prev_page: null,
      },
    } as never)
    mockCompany.spend.list.mockResolvedValue({ data: [] } as never)
    mockCompany.members.list.mockResolvedValue({ data: [] } as never)
  })

  it('shows an admin the Company tabs with Purchases current', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Company Purchases' })).toBeInTheDocument()
    const tabs = screen.getByRole('navigation', { name: 'Company' })
    const people = within(tabs).getByRole('link', { name: 'People' })
    const purchases = within(tabs).getByRole('link', { name: 'Purchases' })
    expect(people).toHaveAttribute('href', '/company/members')
    expect(people).not.toHaveAttribute('aria-current')
    expect(purchases).toHaveAttribute('href', '/company/purchases')
    expect(purchases).toHaveAttribute('aria-current', 'page')
  })

  it('does not show the Company tabs to a non-admin', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.getByText('Only Company admins can view Company purchases.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument()
  })

  it('does not show the Company tabs to a buyer in no Company', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole('link', { name: 'Join a Company' })).toHaveAttribute('href', '/join')
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument()
  })

  it('redirects to login when the session has expired', async () => {
    vi.mocked(getCompanyMembership).mockRejectedValue(new AuthError('expired'))
    await expect(CompanyPurchasesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows the API error inline', async () => {
    mockCompany.purchases.list.mockRejectedValue(new LedewireError('service unavailable', 503))
    await renderPage()
    expect(screen.getByText('API error: service unavailable')).toBeInTheDocument()
  })
})
