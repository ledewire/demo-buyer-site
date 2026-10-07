import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import { activityWindows, getMemberActivity } from './company-activity'
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

describe('getMemberActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserSpendCap.get.mockResolvedValue({ spend_window_timezone: 'America/New_York' } as never)
    mockCompany.spend.list.mockResolvedValue({ data: [] } as never)
  })

  it("reads today and the last 30 days in the Company's timezone, not UTC", async () => {
    await getMemberActivity(['mem-1'], NOW)
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
    expect(await getMemberActivity(['mem-1', 'mem-2'], NOW)).toEqual({
      'mem-1': { todayCents: 320, last30Cents: 4500 },
      'mem-2': { todayCents: 0, last30Cents: 1200 },
    })
  })

  it('makes the same number of spend calls for 1 member as for 50', async () => {
    await getMemberActivity(['mem-1'], NOW)
    const forOne = mockCompany.spend.list.mock.calls.length
    mockCompany.spend.list.mockClear()
    await getMemberActivity(
      Array.from({ length: 50 }, (_, i) => `mem-${i}`),
      NOW,
    )
    expect(mockCompany.spend.list).toHaveBeenCalledTimes(forOne)
    expect(forOne).toBe(2)
  })

  it('reads a member with no spend row as $0 today and $0 over 30 days', async () => {
    mockCompany.spend.list.mockResolvedValue({ data: [spendRow('mem-1', 500)] } as never)
    const activity = await getMemberActivity(['mem-1', 'mem-new'], NOW)
    expect(activity['mem-new']).toEqual({ todayCents: 0, last30Cents: 0 })
  })
})
