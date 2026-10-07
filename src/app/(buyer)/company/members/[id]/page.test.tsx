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

import MemberDetailPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMember, CompanyMembership, CompanyPurchase } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { getCompanyMembership } from '@/lib/company'
import { mockCompany, mockUserSpendCap } from '@/__mocks__/ledewire-client'

const adminMembership: CompanyMembership = {
  id: 'mem-1',
  company_id: 'co-1',
  company_name: 'Acme',
  role: 'admin',
  joined_at: '2026-01-01T00:00:00Z',
}

const agent: CompanyMember = {
  id: 'mem-2',
  user_id: 'user-2',
  name: 'research-agent',
  email: null,
  kind: 'machine',
  role: 'member',
  joined_at: '2026-01-01T00:00:00Z',
  daily_spend_limit_cents: 1000,
}

const purchase: CompanyPurchase = {
  id: 'pur-1',
  kind: 'purchase',
  status: 'completed',
  amount_cents: 250,
  occurred_at: '2026-03-01T12:00:00Z',
  member: {
    id: 'mem-2',
    user_id: 'user-2',
    name: 'research-agent',
    kind: 'machine',
    left_at: null,
  },
} as CompanyPurchase

function purchasePage(page: number, totalPages: number) {
  return {
    data: [purchase],
    pagination: {
      current_page: page,
      per_page: 25,
      total: totalPages * 25,
      total_pages: totalPages,
      next_page: page < totalPages ? page + 1 : null,
      prev_page: page > 1 ? page - 1 : null,
    },
  }
}

function callPage(id = 'mem-2', searchParams: Record<string, string> = {}) {
  return MemberDetailPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchParams),
  })
}

async function renderPage(id?: string, searchParams?: Record<string, string>) {
  return render(await callPage(id, searchParams))
}

describe('MemberDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    mockCompany.members.list.mockResolvedValue({ data: [agent] } as never)
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'UTC' } as never)
    mockCompany.spend.list.mockResolvedValue({
      data: [{ member: purchase.member, spend_cents: 320 }],
    } as never)
    mockCompany.purchases.list.mockResolvedValue(purchasePage(1, 1) as never)
  })

  it('points a buyer in no Company to joining one', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole('link', { name: 'Join a Company' })).toHaveAttribute('href', '/join')
    expect(mockCompany.members.list).not.toHaveBeenCalled()
  })

  it('tells a non-admin member that only admins can view members', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.getByText('Only Company admins can view members.')).toBeInTheDocument()
    expect(mockCompany.members.list).not.toHaveBeenCalled()
    expect(mockCompany.purchases.list).not.toHaveBeenCalled()
  })

  it('redirects to login when the session has expired', async () => {
    vi.mocked(getCompanyMembership).mockRejectedValue(new AuthError('expired'))
    await expect(callPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows the API error inline', async () => {
    mockCompany.members.list.mockRejectedValue(new LedewireError('service unavailable', 503))
    await renderPage()
    expect(screen.getByText('API error: service unavailable')).toBeInTheDocument()
  })

  it('says not found for an id that is not an open membership', async () => {
    await renderPage('mem-gone')
    expect(screen.getByText('No open membership matches this member.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to Members' })).toHaveAttribute(
      'href',
      '/company/members',
    )
    expect(mockCompany.purchases.list).not.toHaveBeenCalled()
  })

  it("shows an admin the member's name, kind and role", async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'research-agent' })).toBeInTheDocument()
    const details = screen.getByLabelText('Member details')
    expect(within(details).getByText('Machine user')).toBeInTheDocument()
    expect(within(details).getByText('Member')).toBeInTheDocument()
  })

  it("shows an admin the member's purchases, filtered to them, on the requested page", async () => {
    await renderPage('mem-2', { page: '2' })
    expect(mockCompany.purchases.list).toHaveBeenCalledWith({
      member: 'mem-2',
      page: 2,
      per_page: 25,
    })
    expect(screen.getByText('pur-1')).toBeInTheDocument()
  })

  it('links to the previous and next pages when there is more than one', async () => {
    mockCompany.purchases.list.mockResolvedValue(purchasePage(2, 3) as never)
    await renderPage('mem-2', { page: '2' })
    expect(screen.getByRole('link', { name: '← Previous' })).toHaveAttribute(
      'href',
      '/company/members/mem-2?page=1',
    )
    expect(screen.getByRole('link', { name: 'Next →' })).toHaveAttribute(
      'href',
      '/company/members/mem-2?page=3',
    )
  })

  it('shows no page links for a single page of purchases', async () => {
    await renderPage()
    expect(screen.queryByRole('link', { name: 'Next →' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '← Previous' })).not.toBeInTheDocument()
  })

  it("shows the member's spend today, over 7 days and over 30 days", async () => {
    await renderPage()
    for (const name of ['Today', 'Last 7 days', 'Last 30 days']) {
      expect(within(screen.getByRole('group', { name })).getByText('$3.20')).toBeInTheDocument()
    }
    expect(mockCompany.spend.list).toHaveBeenCalledWith(
      expect.objectContaining({ member: 'mem-2' }),
    )
  })

  it("shows the cap editor with today's spend against the cap", async () => {
    await renderPage()
    expect(screen.getByLabelText('Edit daily spend cap for research-agent')).toHaveTextContent(
      '$10.00',
    )
    expect(screen.getByText('$3.20 of $10.00 today')).toBeInTheDocument()
  })

  it('links to Company Purchases filtered to this member', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: 'View in Company purchases' })).toHaveAttribute(
      'href',
      '/company/purchases?member=mem-2',
    )
  })
})
