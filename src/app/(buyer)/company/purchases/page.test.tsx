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
// The real module, wrapped so a test can see what the page asks it for.
vi.mock('@/lib/company-activity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/company-activity')>()
  return { ...actual, getCompanyTotals: vi.fn(actual.getCompanyTotals) }
})

import CompanyPurchasesPage from './page'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMembership } from '@ledewire/node'
import { redirect } from 'next/navigation'
import { getCompanyMembership } from '@/lib/company'
import { getCompanyTotals } from '@/lib/company-activity'
import { mockCompany, mockUserSpendCap } from '@/__mocks__/ledewire-client'

const adminMembership: CompanyMembership = {
  id: 'mem-1',
  company_id: 'co-1',
  company_name: 'Acme',
  role: 'admin',
  joined_at: '2026-01-01T00:00:00Z',
}

async function renderPage(searchParams: Record<string, string> = {}) {
  return render(await CompanyPurchasesPage({ searchParams: Promise.resolve(searchParams) }))
}

function purchasePage(total: number, perPage: number) {
  return {
    data: [],
    pagination: {
      current_page: 1,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
      next_page: null,
      prev_page: null,
    },
  }
}

const DAY_MS = 86_400_000

/** A window's length in days, 0 for today: tells the snapshot's three windows apart. */
function windowDays({ from, to }: { from?: string; to?: string }): number {
  return (Date.parse(to!) - Date.parse(from!)) / DAY_MS
}

/** Whether a Company report call is one of the snapshot's: a bare day window. */
function isSnapshotWindow(params: Record<string, unknown>): boolean {
  return Object.keys(params).every((k) => ['from', 'to', 'per_page'].includes(k))
}

// The snapshot's figures for each window, keyed by its length in days.
const SNAPSHOT_SPEND: Record<number, number> = { 0: 320, 6: 1400, 29: 6000 }
const SNAPSHOT_PURCHASES: Record<number, number> = { 0: 2, 6: 9, 29: 41 }

function spendRow(cents: number) {
  return {
    member: { id: 'mem-1', user_id: 'user-1', name: 'Ada Admin', kind: 'human', left_at: null },
    spend_cents: cents,
  }
}

/**
 * Serves the snapshot's windows their own figures. Any other call — the
 * report's, or a snapshot window narrowed by the URL's filters — gets the
 * report's.
 */
function mockCompanyReports() {
  mockCompany.purchases.list.mockImplementation((async (params: Record<string, unknown>) =>
    isSnapshotWindow(params) && params.per_page === 1
      ? purchasePage(SNAPSHOT_PURCHASES[windowDays(params)], 1)
      : purchasePage(0, 25)) as never)
  mockCompany.spend.list.mockImplementation((async (params: Record<string, unknown>) => ({
    data:
      isSnapshotWindow(params) && params.from && params.to
        ? [spendRow(SNAPSHOT_SPEND[windowDays(params)])]
        : [],
  })) as never)
}

function expectSnapshotFigures() {
  const snapshot = screen.getByRole('region', { name: 'Company activity' })
  for (const [name, spend, purchases] of [
    ['Today', '$3.20', '2 purchases'],
    ['Last 7 days', '$14.00', '9 purchases'],
    ['Last 30 days', '$60.00', '41 purchases'],
  ]) {
    const group = within(snapshot).getByRole('group', { name })
    expect(within(group).getByText(spend)).toBeInTheDocument()
    expect(within(group).getByText(purchases)).toBeInTheDocument()
  }
  expect(
    within(snapshot).getByText('Spend counts captured amounts only, not live bulk holds.'),
  ).toBeInTheDocument()
}

describe('CompanyPurchasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCompanyMembership).mockResolvedValue(adminMembership)
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'UTC' } as never)
    mockCompanyReports()
    mockCompany.members.list.mockResolvedValue({ data: [] } as never)
  })

  it("shows an admin the Company's activity snapshot", async () => {
    await renderPage()
    expectSnapshotFigures()
  })

  it("keeps the snapshot Company-wide whatever the report's filters", async () => {
    await renderPage({ member: 'mem-1', from: '2026-01-01', to: '2026-01-31', kind: 'purchase' })
    expect(getCompanyTotals).toHaveBeenCalledTimes(1)
    expect(getCompanyTotals).toHaveBeenCalledWith()
    expectSnapshotFigures()
  })

  it('does not show a non-admin the activity snapshot', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue({ ...adminMembership, role: 'member' })
    await renderPage()
    expect(screen.queryByRole('region', { name: 'Company activity' })).not.toBeInTheDocument()
    expect(getCompanyTotals).not.toHaveBeenCalled()
  })

  it('does not show a buyer in no Company the activity snapshot', async () => {
    vi.mocked(getCompanyMembership).mockResolvedValue(null)
    await renderPage()
    expect(screen.queryByRole('region', { name: 'Company activity' })).not.toBeInTheDocument()
    expect(getCompanyTotals).not.toHaveBeenCalled()
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
