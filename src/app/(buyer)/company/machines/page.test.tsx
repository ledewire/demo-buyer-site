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

import CompanyMachinesPage from './page'
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

const researchAgent = makeMember({
  id: 'mem-2',
  user_id: 'user-2',
  kind: 'machine',
  email: null,
  name: 'research-agent',
  role: 'member',
})

async function renderPage() {
  return render(await CompanyMachinesPage())
}

describe('CompanyMachinesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    mockCompany.members.list.mockResolvedValue({ data: [makeMember(), researchAgent] } as never)
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'UTC' } as never)
    mockCompany.spend.list.mockResolvedValue({ data: [] } as never)
    mockCompany.purchases.list.mockResolvedValue({
      data: [],
      pagination: {
        current_page: 1,
        per_page: 1,
        total: 0,
        total_pages: 0,
        next_page: null,
        prev_page: null,
      },
    } as never)
  })

  it('points a buyer in no Company to joining one', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.getByRole('link', { name: 'Join a Company' })).toHaveAttribute('href', '/join')
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument()
    expect(mockCompany.members.list).not.toHaveBeenCalled()
  })

  it('tells a non-admin member that only admins can manage machines', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.getByText('Only Company admins can manage machines.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Company' })).not.toBeInTheDocument()
    expect(mockCompany.members.list).not.toHaveBeenCalled()
    expect(mockCompany.spend.list).not.toHaveBeenCalled()
  })

  it('redirects to login when the session has expired', async () => {
    vi.mocked(getCompanyMembership).mockRejectedValue(new AuthError('expired'))
    await expect(CompanyMachinesPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('shows the API error inline', async () => {
    mockCompany.members.list.mockRejectedValue(new LedewireError('service unavailable', 503))
    await renderPage()
    expect(screen.getByText('API error: service unavailable')).toBeInTheDocument()
  })

  it('lists only the Machine users of a mixed Company', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Machines' })).toBeInTheDocument()
    expect(screen.getByText('research-agent')).toBeInTheDocument()
    expect(screen.queryByText('Ada Admin')).not.toBeInTheDocument()
  })

  it("loads activity for the machines only and shows each machine's spend against its cap", async () => {
    mockCompany.spend.list.mockResolvedValue({
      data: [
        {
          member: { id: 'mem-2', user_id: 'user-2', name: 'research-agent', kind: 'machine' },
          spend_cents: 450,
        },
      ],
    } as never)
    await renderPage()
    expect(getCompanyActivity).toHaveBeenCalledWith(['mem-2'])
    expect(screen.getByText('$4.50 of $10.00 today')).toBeInTheDocument()
    expect(screen.getByText('$4.50 last 30 days')).toBeInTheDocument()
  })

  it('offers the Add machine form, not the invite form or pending invitations', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: 'Add machine' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send invitation' })).not.toBeInTheDocument()
    expect(screen.queryByText(/pending invitations/i)).not.toBeInTheDocument()
    expect(mockCompany.invitations.list).not.toHaveBeenCalled()
  })

  it('shows an empty state to an admin of a Company with no machines', async () => {
    mockCompany.members.list.mockResolvedValue({ data: [makeMember()] } as never)
    await renderPage()
    expect(screen.getByText('No machine users yet.')).toBeInTheDocument()
    expect(getCompanyActivity).toHaveBeenCalledWith([])
  })

  it('shows the Company tabs with Machines current', async () => {
    await renderPage()
    const tabs = screen.getByRole('navigation', { name: 'Company' })
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['People', 'Machines', 'Purchases'])
    const machines = within(tabs).getByRole('link', { name: 'Machines' })
    expect(machines).toHaveAttribute('href', '/company/machines')
    expect(machines).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('link', { name: 'People' })).not.toHaveAttribute('aria-current')
  })
})
