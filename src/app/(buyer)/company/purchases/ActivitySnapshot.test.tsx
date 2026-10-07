import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ActivitySnapshot from './ActivitySnapshot'
import type { CompanyTotals } from '@/lib/company-activity'

const totals: CompanyTotals = {
  today: { spendCents: 320, purchaseCount: 1 },
  last7: { spendCents: 1400, purchaseCount: 9 },
  last30: { spendCents: 6000, purchaseCount: 41 },
}

describe('ActivitySnapshot', () => {
  it("shows the Company's spend and purchase count for each window", () => {
    render(<ActivitySnapshot totals={totals} />)
    const today = screen.getByRole('group', { name: 'Today' })
    const last7 = screen.getByRole('group', { name: 'Last 7 days' })
    const last30 = screen.getByRole('group', { name: 'Last 30 days' })
    expect(within(today).getByText('$3.20')).toBeInTheDocument()
    expect(within(today).getByText('1 purchase')).toBeInTheDocument()
    expect(within(last7).getByText('$14.00')).toBeInTheDocument()
    expect(within(last7).getByText('9 purchases')).toBeInTheDocument()
    expect(within(last30).getByText('$60.00')).toBeInTheDocument()
    expect(within(last30).getByText('41 purchases')).toBeInTheDocument()
  })

  it('notes that spend counts captured amounts only, not live bulk holds', () => {
    render(<ActivitySnapshot totals={totals} />)
    expect(
      screen.getByText('Spend counts captured amounts only, not live bulk holds.'),
    ).toBeInTheDocument()
  })

  it('is labelled as Company-wide activity, apart from the filters', () => {
    render(<ActivitySnapshot totals={totals} />)
    const section = screen.getByRole('region', { name: 'Company activity' })
    expect(within(section).getByRole('group', { name: 'Today' })).toBeInTheDocument()
    expect(
      within(section).getByText('All members, whatever the filters below.'),
    ).toBeInTheDocument()
  })

  it('does not link anywhere', () => {
    render(<ActivitySnapshot totals={totals} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
