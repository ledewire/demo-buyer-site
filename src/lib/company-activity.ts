import type { CompanySpendList } from '@ledewire/node'
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

/**
 * Each member's spend today and over the last 30 days, keyed by membership id,
 * with an entry for every id in `memberIds` — a member with no spend reads as 0.
 * Days are the Company's, read from the admin's own spend window timezone. One
 * `company.spend.list` call per window, however many members there are.
 */
export async function getMemberActivity(
  memberIds: string[],
  now: Date = new Date(),
): Promise<Record<string, MemberActivity>> {
  const client = await createBuyerClient()
  const { spend_window_timezone } = await client.user.spendCap.get()
  const windows = activityWindows(spend_window_timezone, now)
  const [today, last30] = (
    await Promise.all([
      client.company.spend.list(windows.today),
      client.company.spend.list(windows.last30),
    ])
  ).map(spendById)
  return Object.fromEntries(
    memberIds.map((id) => [
      id,
      { todayCents: today.get(id) ?? 0, last30Cents: last30.get(id) ?? 0 },
    ]),
  )
}
