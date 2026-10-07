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

import CompanyMembersPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMember, CompanyMembership } from '@ledewire/node'
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

  it('shows an admin the People and Machines sections', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument()
    const people = screen.getByRole('region', { name: 'People' })
    const machines = screen.getByRole('region', { name: 'Machines' })
    expect(within(people).getByText('Ada Admin')).toBeInTheDocument()
    expect(within(machines).getByText('research-agent')).toBeInTheDocument()
  })

  it("shows an admin each member's spend against their cap", async () => {
    await renderPage()
    const people = screen.getByRole('region', { name: 'People' })
    const machines = screen.getByRole('region', { name: 'Machines' })
    expect(within(people).getByText('$3.20 of $10.00 today')).toBeInTheDocument()
    expect(within(people).getByText('$3.20 last 30 days')).toBeInTheDocument()
    expect(within(machines).getByText('$0.00 of $10.00 today')).toBeInTheDocument()
  })

  it("does not read the Company's spend for a non-admin", async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(mockCompany.spend.list).not.toHaveBeenCalled()
  })
})
