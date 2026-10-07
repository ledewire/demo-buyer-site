import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { formatCents } from '@/lib/format'
import { AuthError, LedewireError } from '@ledewire/node'
import CompanyTabs from '../CompanyTabs'
import NotInCompany from '../NotInCompany'
import CompanyPurchasesTable from './CompanyPurchasesTable'
import Pagination from './Pagination'
import { parseFilters, type Filters, type SearchParams } from './filters'

const PER_PAGE = 25

function pageHref(filters: Filters, page: number): string {
  const qs = new URLSearchParams({ ...filters, page: String(page) } as Record<string, string>)
  return `/company/purchases?${qs.toString()}`
}

const INPUT = 'mt-1 block rounded-md border-gray-300 shadow-xs text-sm'
const LABEL = 'block text-sm font-medium text-gray-700'

export default async function CompanyPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAuth()
  const { filters, page } = parseFilters(await searchParams)

  try {
    const membership = await getCompanyMembership()
    if (!membership) {
      return <NotInCompany />
    }
    if (membership.role !== 'admin') {
      return (
        <p className="text-sm text-gray-500">Only Company admins can view Company purchases.</p>
      )
    }

    const client = await createBuyerClient()
    const spendFilters = { member: filters.member, from: filters.from, to: filters.to }
    const [purchases, spend, members] = await Promise.all([
      client.company.purchases.list({ ...filters, page, per_page: PER_PAGE }),
      client.company.spend.list(spendFilters),
      client.company.members.list(),
    ])

    return (
      <div className="space-y-8">
        <CompanyTabs current="purchases" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Purchases</h1>
          <p className="mt-1 text-sm text-gray-500">
            Everything {membership.company_name} has paid for. Dates are in the Company&apos;s
            timezone.
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="member" className={LABEL}>
              Member
            </label>
            <select id="member" name="member" defaultValue={filters.member ?? ''} className={INPUT}>
              <option value="">All members</option>
              {members.data.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="from" className={LABEL}>
              From
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={filters.from}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="to" className={LABEL}>
              To
            </label>
            <input id="to" name="to" type="date" defaultValue={filters.to} className={INPUT} />
          </div>
          <div>
            <label htmlFor="kind" className={LABEL}>
              Kind
            </label>
            <select id="kind" name="kind" defaultValue={filters.kind ?? ''} className={INPUT}>
              <option value="">All</option>
              <option value="purchase">Purchases</option>
              <option value="bulk_acquisition">Bulk exports</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Apply
          </button>
          <Link
            href="/company/purchases"
            className="text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Reset
          </Link>
        </form>

        <div className="space-y-3">
          <CompanyPurchasesTable purchases={purchases.data} />
          <Pagination pagination={purchases.pagination} hrefFor={(n) => pageHref(filters, n)} />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Spend by member</h2>
          <p className="text-xs text-gray-500">
            {filters.from || filters.to ? 'For the selected dates.' : 'Lifetime spend.'} Counts only
            captured amounts, not live bulk holds.
          </p>
          {spend.data.length === 0 ? (
            <p className="text-sm text-gray-500">No spend recorded.</p>
          ) : (
            <ul className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-w-lg">
              {spend.data.map(({ member, spend_cents }) => (
                <li key={member.id} className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-800">
                    {member.name}
                    {member.left_at && <span className="ml-2 text-xs text-gray-400">left</span>}
                  </span>
                  <span className="font-medium text-gray-800">{formatCents(spend_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }
}
