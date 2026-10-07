import type { CompanyPurchaseList, CompanySpendList } from '@ledewire/node'
import { createBuyerClient } from './ledewire'

/**
 * An inclusive range of `YYYY-MM-DD` days, as the Company report filters take it.
 * A type alias, not an interface, so it satisfies the filters' index signature.
 */
export type DayWindow = {
  from: string
  to: string
}

/** One member's spend of the Company's money, in cents. */
export interface MemberActivity {
  todayCents: number
  last30Cents: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The calendar date in `timeZone` at the instant `now`, as `YYYY-MM-DD`. */
function dateIn(timeZone: string, now: Date): string {
  // Assemble from parts rather than trust any locale's date format.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** The `YYYY-MM-DD` date `days` before `date`, by the calendar. */
function daysBefore(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10)
}

/** Today, the last 7 days and the last 30 days, each inclusive of today. */
export interface ActivityWindows {
  today: DayWindow
  last7: DayWindow
  last30: DayWindow
}

/** The activity windows as calendar days in the Company's timezone. */
export function activityWindows(timeZone: string, now: Date): ActivityWindows {
  const today = dateIn(timeZone, now)
  return {
    today: { from: today, to: today },
    last7: { from: daysBefore(today, 6), to: today },
    last30: { from: daysBefore(today, 29), to: today },
  }
}

/** Spend cents per membership id, from a `company.spend.list` response. */
function spendById(list: CompanySpendList): Map<string, number> {
  return new Map(list.data.map((row) => [row.member.id, row.spend_cents]))
}

/** The Company's captured spend and purchase count over one window. */
export interface WindowTotals {
  spendCents: number
  purchaseCount: number
}

/** The Company's totals for each activity window. */
export type CompanyTotals = Record<keyof ActivityWindows, WindowTotals>

/** A window's totals: its spend rows summed, its purchase count from the listing's total. */
function windowTotals(spend: CompanySpendList, purchases: CompanyPurchaseList): WindowTotals {
  return {
    spendCents: spend.data.reduce((sum, row) => sum + row.spend_cents, 0),
    purchaseCount: purchases.pagination.total,
  }
}

export interface CompanyActivity {
  /** Each member's spend, keyed by membership id. */
  members: Record<string, MemberActivity>
}

/**
 * Each member's spend today and over the last 30 days, keyed by membership id,
 * with an entry for every id in `memberIds` — a member with no spend reads as
 * 0. Days are the Company's, read from the admin's own spend window timezone.
 * A fixed number of SDK calls, however many members there are: one
 * `company.spend.list` per window.
 */
export async function getCompanyActivity(
  memberIds: string[],
  now: Date = new Date(),
): Promise<CompanyActivity> {
  const client = await createBuyerClient()
  const { spend_window_timezone } = await client.user.spendCap.get()
  const windows = activityWindows(spend_window_timezone, now)
  const [today, last30] = await Promise.all([
    client.company.spend.list(windows.today),
    client.company.spend.list(windows.last30),
  ])
  const todayById = spendById(today)
  const last30ById = spendById(last30)
  return {
    members: Object.fromEntries(
      memberIds.map((id) => [
        id,
        { todayCents: todayById.get(id) ?? 0, last30Cents: last30ById.get(id) ?? 0 },
      ]),
    ),
  }
}

/**
 * The Company's spend and purchase count today, over 7 days and over 30 days,
 * in the Company's days. Company-wide: it takes no member or date filter. One
 * `company.spend.list` and one single-row `company.purchases.list` (for its
 * `pagination.total`) per window.
 */
export async function getCompanyTotals(now: Date = new Date()): Promise<CompanyTotals> {
  const client = await createBuyerClient()
  const { spend_window_timezone } = await client.user.spendCap.get()
  const windows = activityWindows(spend_window_timezone, now)
  const totalsIn = async (window: DayWindow) =>
    windowTotals(
      ...(await Promise.all([
        client.company.spend.list(window),
        client.company.purchases.list({ ...window, per_page: 1 }),
      ])),
    )
  const [today, last7, last30] = await Promise.all([
    totalsIn(windows.today),
    totalsIn(windows.last7),
    totalsIn(windows.last30),
  ])
  return { today, last7, last30 }
}

/** One member's spend of the Company's money over each activity window, in cents. */
export interface MemberSpend {
  todayCents: number
  last7Cents: number
  last30Cents: number
}

/**
 * One member's spend today, over 7 days and over 30 days, in the Company's
 * days: one `company.spend.list` per window, filtered to `membershipId`. A
 * member with no spend in a window reads as 0.
 */
export async function getMemberSpend(
  membershipId: string,
  now: Date = new Date(),
): Promise<MemberSpend> {
  const client = await createBuyerClient()
  const { spend_window_timezone } = await client.user.spendCap.get()
  const windows = activityWindows(spend_window_timezone, now)
  const spendIn = async (window: DayWindow) => {
    const list = await client.company.spend.list({ member: membershipId, ...window })
    return spendById(list).get(membershipId) ?? 0
  }
  const [todayCents, last7Cents, last30Cents] = await Promise.all([
    spendIn(windows.today),
    spendIn(windows.last7),
    spendIn(windows.last30),
  ])
  return { todayCents, last7Cents, last30Cents }
}
