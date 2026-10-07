import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import {
  activityWindows,
  getCompanyActivity,
  getCompanyTotals,
  getMemberSpend,
} from './company-activity'
import { mockCompany, mockUserSpendCap } from '@/__mocks__/ledewire-client'

// 02:00 UTC on 10 March is still 9 March (22:00 EDT) in New York.
const NOW = new Date('2026-03-10T02:00:00Z')

function spendRow(membershipId: string, spendCents: number) {
  return {
    member: {
      id: membershipId,
      user_id: `u-${membershipId}`,
      name: membershipId,
      kind: 'human',
      left_at: null,
    },
    spend_cents: spendCents,
  }
}

function purchasePage(total: number) {
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
}

describe('activityWindows', () => {
  it('builds inclusive today, 7-day and 30-day windows ending on the Company date', () => {
    expect(activityWindows('America/New_York', NOW)).toEqual({
      today: { from: '2026-03-09', to: '2026-03-09' },
      last7: { from: '2026-03-03', to: '2026-03-09' },
      last30: { from: '2026-02-08', to: '2026-03-09' },
    })
  })

  it('takes the next day for a timezone already past midnight', () => {
    // 23:00 UTC on 9 March is already noon on 10 March in Auckland (NZDT, UTC+13).
    expect(activityWindows('Pacific/Auckland', new Date('2026-03-09T23:00:00Z')).today).toEqual({
      from: '2026-03-10',
      to: '2026-03-10',
    })
  })
})

describe('getCompanyActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'America/New_York' } as never)
    mockCompany.spend.list.mockResolvedValue({ data: [] } as never)
    mockCompany.purchases.list.mockResolvedValue(purchasePage(0) as never)
  })

  it("reads today and the last 30 days in the Company's timezone, not UTC", async () => {
    await getCompanyActivity(['mem-1'], NOW)
    expect(mockCompany.spend.list).toHaveBeenCalledWith({ from: '2026-03-09', to: '2026-03-09' })
    expect(mockCompany.spend.list).toHaveBeenCalledWith({ from: '2026-02-08', to: '2026-03-09' })
  })

  it("maps each member's spend today and over 30 days by membership id", async () => {
    mockCompany.spend.list.mockImplementation((async ({ from }: { from: string }) => ({
      data:
        from === '2026-03-09'
          ? [spendRow('mem-1', 320)]
          : [spendRow('mem-1', 4500), spendRow('mem-2', 1200)],
    })) as never)
    expect((await getCompanyActivity(['mem-1', 'mem-2'], NOW)).members).toEqual({
      'mem-1': { todayCents: 320, last30Cents: 4500 },
      'mem-2': { todayCents: 0, last30Cents: 1200 },
    })
  })

  it('makes the same number of SDK calls for 1 member as for 50', async () => {
    async function sdkCallsFor(memberCount: number) {
      vi.clearAllMocks()
      const ids = Array.from({ length: memberCount }, (_, i) => `mem-${i}`)
      mockCompany.spend.list.mockResolvedValue({
        data: ids.map((id) => spendRow(id, 100)),
      } as never)
      await getCompanyActivity(ids, NOW)
      return (
        mockUserSpendCap.get.mock.calls.length +
        mockCompany.spend.list.mock.calls.length +
        mockCompany.purchases.list.mock.calls.length
      )
    }
    const forOne = await sdkCallsFor(1)
    expect(await sdkCallsFor(50)).toBe(forOne)
    expect(forOne).toBe(3)
  })

  it('does not read purchases', async () => {
    await getCompanyActivity(['mem-1'], NOW)
    expect(mockCompany.purchases.list).not.toHaveBeenCalled()
  })

  it('reads a member with no spend row as $0 today and $0 over 30 days', async () => {
    mockCompany.spend.list.mockResolvedValue({ data: [spendRow('mem-1', 500)] } as never)
    const { members } = await getCompanyActivity(['mem-1', 'mem-new'], NOW)
    expect(members['mem-new']).toEqual({ todayCents: 0, last30Cents: 0 })
  })
})

describe('getCompanyTotals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'America/New_York' } as never)
  })

  it("sums the Company's spend and reads its purchase count from pagination.total per window", async () => {
    const spend: Record<string, number[]> = {
      '2026-03-09': [320],
      '2026-03-03': [320, 1000, 80],
      '2026-02-08': [4500, 1200, 300],
    }
    const purchases: Record<string, number> = {
      '2026-03-09': 2,
      '2026-03-03': 9,
      '2026-02-08': 41,
    }
    mockCompany.spend.list.mockImplementation((async ({ from }: { from: string }) => ({
      data: spend[from].map((cents, i) => spendRow(`mem-${i}`, cents)),
    })) as never)
    mockCompany.purchases.list.mockImplementation((async ({ from }: { from: string }) =>
      purchasePage(purchases[from])) as never)

    expect(await getCompanyTotals(NOW)).toEqual({
      today: { spendCents: 320, purchaseCount: 2 },
      last7: { spendCents: 1400, purchaseCount: 9 },
      last30: { spendCents: 6000, purchaseCount: 41 },
    })
    expect(mockCompany.purchases.list).toHaveBeenCalledWith({
      from: '2026-03-03',
      to: '2026-03-09',
      per_page: 1,
    })
  })
})

describe('getMemberSpend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'America/New_York' } as never)
  })

  it("reads one member's spend today, over 7 days and over 30 days with the member filter", async () => {
    const spendByFrom: Record<string, number> = {
      '2026-03-09': 320,
      '2026-03-03': 1400,
      '2026-02-08': 6000,
    }
    mockCompany.spend.list.mockImplementation((async ({ from }: { from: string }) => ({
      data: [spendRow('mem-7', spendByFrom[from])],
    })) as never)

    expect(await getMemberSpend('mem-7', NOW)).toEqual({
      todayCents: 320,
      last7Cents: 1400,
      last30Cents: 6000,
    })
    expect(mockCompany.spend.list).toHaveBeenCalledTimes(3)
    expect(mockCompany.spend.list).toHaveBeenCalledWith({
      member: 'mem-7',
      from: '2026-03-09',
      to: '2026-03-09',
    })
    expect(mockCompany.spend.list).toHaveBeenCalledWith({
      member: 'mem-7',
      from: '2026-03-03',
      to: '2026-03-09',
    })
    expect(mockCompany.spend.list).toHaveBeenCalledWith({
      member: 'mem-7',
      from: '2026-02-08',
      to: '2026-03-09',
    })
  })

  it('reads a member with no spend row as $0', async () => {
    mockCompany.spend.list.mockResolvedValue({ data: [] } as never)
    expect(await getMemberSpend('mem-7', NOW)).toEqual({
      todayCents: 0,
      last7Cents: 0,
      last30Cents: 0,
    })
  })
})
