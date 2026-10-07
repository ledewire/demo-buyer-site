import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/company', () => ({ getCompanyMembership: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
// The real module, wrapped so a test can see which members the page asks about.
vi.mock('@/lib/company-activity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/company-activity')>()
  return { ...actual, getCompanyActivity: vi.fn(actual.getCompanyActivity) }
})

import CompanyMembersPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMember, CompanyMembership } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { getCompanyMembership } from '@/lib/company'
import { getCompanyActivity } from '@/lib/company-activity'
import { mockCompany, mockUserSpendCap } from '@/__mocks__/ledewire-client'

const adminMembership: CompanyMembership = {
  id: 'mem-1',
  company_id: 'co-1',
  company_name: 'Acme',
  role: 'admin',
  joined_at: '2026-01-01T00:00:00Z',
}

function makeMember(overrides: Partial<CompanyMember> = {}): CompanyMember {
  return {
    id: 'mem-1',
    user_id: 'user-1',
    name: 'Ada Admin',
    email: 'ada@example.com',
    kind: 'human',
    role: 'admin',
    joined_at: '2026-01-01T00:00:00Z',
    daily_spend_limit_cents: 1000,
    ...overrides,
  }
}

async function renderPage() {
  return render(await CompanyMembersPage())
}

describe('CompanyMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    mockCompany.members.list.mockResolvedValue({
      data: [
        makeMember(),
        makeMember({
          id: 'mem-2',
          user_id: 'user-2',
          kind: 'machine',
          email: null,
          name: 'research-agent',
          role: 'member',
        }),
      ],
    } as never)
    mockCompany.invitations.list.mockResolvedValue({ data: [] } as never)
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'UTC' } as never)
    mockCompany.spend.list.mockResolvedValue({
      data: [
        {
          member: {
            id: 'mem-1',
            user_id: 'user-1',
            name: 'Ada Admin',
            kind: 'human',
            left_at: null,
          },
          spend_cents: 320,
        },
      ],
    } as never)
    // A distinct purchase count per window, told apart by its length in days.
    const purchasesByDays: Record<number, number> = { 0: 2, 6: 9, 29: 41 }
    mockCompany.purchases.list.mockImplementation((async ({
      from,
      to,
    }: {
      from: string
      to: string
    }) => {
      const total = purchasesByDays[(Date.parse(to) - Date.parse(from)) / 86_400_000]
      return {
        data: [],
        pagination: {
          current_page: 1,
          per_page: 1,
          total,
          total_pages: total,
          next_page: null,
          prev_page: null,
        },
      }
    }) as never)
  })

  it('points a buyer in no Company to joining one', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole('link', { name: 'Join a Company' })).toHaveAttribute('href', '/join')
    expect(mockCompany.members.list).not.toHaveBeenCalled()
  })

  it('tells a non-admin member that only admins can manage members', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.getByText('Only Company admins can manage members.')).toBeInTheDocument()
    expect(mockCompany.members.list).not.toHaveBeenCalled()
  })

  it('redirects to login when the session has expired', async () => {
    vi.mocked(getCompanyMembership).mockRejectedValue(new AuthError('expired'))
    await expect(CompanyMembersPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows the API error inline', async () => {
    mockCompany.members.list.mockRejectedValue(new LedewireError('service unavailable', 503))
    await renderPage()
    expect(screen.getByText('API error: service unavailable')).toBeInTheDocument()
  })

  it('lists only the people of a mixed Company', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument()
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
    expect(screen.queryByText('research-agent')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Machines' })).not.toBeInTheDocument()
  })

  it('offers the invite form and pending invitations, not the Add machine form', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeInTheDocument()
    expect(screen.getByText('No pending invitations.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add machine' })).not.toBeInTheDocument()
  })

  it("loads activity for the people only and shows each person's spend against their cap", async () => {
    await renderPage()
    expect(getCompanyActivity).toHaveBeenCalledWith(['mem-1'])
    expect(screen.getByText('$3.20 of $10.00 today')).toBeInTheDocument()
    expect(screen.getByText('$3.20 last 30 days')).toBeInTheDocument()
  })

  it("does not read the Company's spend for a non-admin", async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(mockCompany.spend.list).not.toHaveBeenCalled()
  })

  it("shows an admin the Company's activity snapshot", async () => {
    await renderPage()
    for (const [name, purchases] of [
      ['Today', '2 purchases'],
      ['Last 7 days', '9 purchases'],
      ['Last 30 days', '41 purchases'],
    ]) {
      const group = screen.getByRole('group', { name })
      expect(within(group).getByText('$3.20')).toBeInTheDocument()
      expect(within(group).getByText(purchases)).toBeInTheDocument()
    }
    expect(
      screen.getByText('Spend counts captured amounts only, not live bulk holds.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Company purchases' })).toHaveAttribute(
      'href',
      '/company/purchases',
    )
  })

  it('does not show a non-admin the activity snapshot', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.queryByRole('group', { name: 'Today' })).not.toBeInTheDocument()
    expect(mockCompany.purchases.list).not.toHaveBeenCalled()
  })

  it('shows an admin the Company tabs with People current', async () => {
    await renderPage()
    const tabs = screen.getByRole('navigation', { name: 'Company' })
    const people = within(tabs).getByRole('link', { name: 'People' })
    const purchases = within(tabs).getByRole('link', { name: 'Purchases' })
    expect(people).toHaveAttribute('href', '/company/members')
    expect(people).toHaveAttribute('aria-current', 'page')
    expect(purchases).toHaveAttribute('href', '/company/purchases')
    expect(purchases).not.toHaveAttribute('aria-current')
  })

  it('does not show the Company tabs to a non-admin', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument()
  })

  it('does not show the Company tabs to a buyer in no Company', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument()
  })
})
