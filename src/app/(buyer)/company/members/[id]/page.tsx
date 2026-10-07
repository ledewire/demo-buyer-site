import { useId } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { getMemberActivity } from '@/lib/company-activity'
import { formatCents } from '@/lib/format'
import { AuthError, LedewireError } from '@ledewire/node'
import CompanyPurchasesTable from '../../purchases/CompanyPurchasesTable'
import { parseFilters, type SearchParams } from '../../purchases/filters'
import MemberCapEditor from './MemberCapEditor'

const PER_PAGE = 25

function SpendTile({ label, cents }: { label: string; cents: number }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="px-4 py-3">
      <p id={id} className="text-xs font-medium text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{formatCents(cents)}</p>
    </div>
  )
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<SearchParams>
}) {
  await requireAuth()
  const { id } = await params
  const { page } = parseFilters(await searchParams)
  const memberPath = `/company/members/${encodeURIComponent(id)}`

  try {
    const membership = await getCompanyMembership()
    if (!membership) {
      return (
        <p className="text-sm text-gray-500">
          You&apos;re not part of a Company. Have an invitation?{' '}
          <Link href="/join" className="text-indigo-600 hover:text-indigo-800">
            Join a Company
          </Link>
        </p>
      )
    }
    if (membership.role !== 'admin') {
      return <p className="text-sm text-gray-500">Only Company admins can view members.</p>
    }

    const client = await createBuyerClient()
    const members = await client.company.members.list()
    const member = members.data.find((m) => m.id === id)
    if (!member) {
      return (
        <p className="text-sm text-gray-500">
          No open membership matches this member.{' '}
          <Link href="/company/members" className="text-indigo-600 hover:text-indigo-800">
            Back to Members
          </Link>
        </p>
      )
    }

    const [activity, purchases] = await Promise.all([
      getMemberActivity(member.id),
      client.company.purchases.list({ member: member.id, page, per_page: PER_PAGE }),
    ])
    const { pagination } = purchases

    return (
      <div className="space-y-8">
        <div>
          <Link href="/company/members" className="text-sm text-indigo-600 hover:text-indigo-800">
            ← Members
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{member.name}</h1>
          <dl aria-label="Member details" className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1">
              <dt className="text-gray-500">Kind:</dt>
              <dd className="text-gray-800">
                {member.kind === 'machine' ? 'Machine user' : 'Person'}
              </dd>
            </div>
            {member.email && (
              <div className="flex gap-1">
                <dt className="text-gray-500">Email:</dt>
                <dd className="text-gray-800">{member.email}</dd>
              </div>
            )}
            <div className="flex gap-1">
              <dt className="text-gray-500">Role:</dt>
              <dd className="text-gray-800">{member.role === 'admin' ? 'Admin' : 'Member'}</dd>
            </div>
          </dl>
        </div>

        <MemberCapEditor member={member} todayCents={activity.todayCents} />

        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-gray-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <SpendTile label="Today" cents={activity.todayCents} />
            <SpendTile label="Last 7 days" cents={activity.last7Cents} />
            <SpendTile label="Last 30 days" cents={activity.last30Cents} />
          </div>
          <p className="text-xs text-gray-500">
            Spend counts captured amounts only, not live bulk holds.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-800">Purchases and Bulk exports</h2>
            <Link
              href={`/company/purchases?${new URLSearchParams({ member: member.id })}`}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              View in Company purchases
            </Link>
          </div>
          <CompanyPurchasesTable
            purchases={purchases.data}
            emptyMessage={`${member.name} hasn't bought anything yet.`}
          />
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Page {pagination.current_page} of {pagination.total_pages} · {pagination.total}{' '}
                total
              </span>
              <div className="space-x-4">
                {pagination.prev_page && (
                  <Link
                    href={`${memberPath}?page=${pagination.prev_page}`}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    ← Previous
                  </Link>
                )}
                {pagination.next_page && (
                  <Link
                    href={`${memberPath}?page=${pagination.next_page}`}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
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
