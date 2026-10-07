import { useId } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { getMemberSpend } from '@/lib/company-activity'
import { formatCents } from '@/lib/format'
import { AuthError, LedewireError, type CompanyMember } from '@ledewire/node'
import NotInCompany from '../../NotInCompany'
import CompanyPurchasesTable from '../../purchases/CompanyPurchasesTable'
import Pagination from '../../purchases/Pagination'
import { parseFilters, type SearchParams } from '../../purchases/filters'
import MachineKeyManager from './MachineKeyManager'
import MemberCapEditor from './MemberCapEditor'

const PER_PAGE = 25

type BuyerClient = Awaited<ReturnType<typeof createBuyerClient>>

/**
 * A machine member's Buyer keys, with the Machine user id their routes take, or null for a
 * human member or one no Machine user matches. The membership names the Machine user's
 * Buyer by `user_id`.
 */
async function findMachineBuyerKeys(client: BuyerClient, member: CompanyMember) {
  if (member.kind !== 'machine') return null
  const machineUsers = await client.company.machineUsers.list()
  const machineUser = machineUsers.data.find((m) => m.user_id === member.user_id)
  if (!machineUser) return null
  const keys = await client.company.machineUsers.buyerKeys.list(machineUser.id)
  return { machineUserId: machineUser.id, keys: keys.data }
}

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
      return <NotInCompany />
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

    const [activity, purchases, buyerKeys] = await Promise.all([
      getMemberSpend(member.id),
      client.company.purchases.list({ member: member.id, page, per_page: PER_PAGE }),
      findMachineBuyerKeys(client, member),
    ])
    const pastLastPage = purchases.data.length === 0 && purchases.pagination.total > 0

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

        {buyerKeys && (
          <MachineKeyManager
            title="Buyer keys"
            apiPath={`/api/company/machine-users/${encodeURIComponent(buyerKeys.machineUserId)}/buyer-keys`}
            initialKeys={buyerKeys.keys}
          />
        )}

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
          {pastLastPage ? (
            <p className="text-sm text-gray-500">
              There are no purchases on this page.{' '}
              <Link href={memberPath} className="text-indigo-600 hover:text-indigo-800">
                Go to the first page
              </Link>
            </p>
          ) : (
            <CompanyPurchasesTable
              purchases={purchases.data}
              emptyMessage={`${member.name} hasn't bought anything yet.`}
            />
          )}
          <Pagination
            pagination={purchases.pagination}
            hrefFor={(n) => `${memberPath}?page=${n}`}
          />
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
