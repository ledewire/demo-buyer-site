import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { AuthError, LedewireError } from '@ledewire/node'
import type { CompanyMembership } from '@ledewire/node'
import { formatCents } from '@/lib/format'
import { listItems } from '@/lib/list-items'
import CompanyPurchasesTable from '../company/purchases/CompanyPurchasesTable'
import PendingTopUps from './PendingTopUps'
import TransactionList from './TransactionList'
import WalletFund from './WalletFund'

export default async function WalletPage() {
  await requireAuth()

  try {
    const membership = await getCompanyMembership()
    return membership ? <CompanyWallet membership={membership} /> : <PersonalWallet />
  } catch (err) {
    if (err instanceof AuthError) redirect('/login')
    if (err instanceof LedewireError) {
      return <p className="text-red-600 text-sm">API error: {err.message}</p>
    }
    throw err
  }
}

async function PersonalWallet() {
  const client = await createBuyerClient()
  const [balance, transactionList] = await Promise.all([
    client.wallet.balance(),
    client.wallet.transactions(),
  ])
  const transactions = listItems(transactionList)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Available balance</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCents(balance.balance_cents ?? 0)}
          </p>
          {balance.held_cents > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {formatCents(balance.held_cents)} held for bulk exports in progress
            </p>
          )}
        </div>
        <WalletFund />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Transaction History</h2>
        <TransactionList transactions={transactions} />
      </div>
    </div>
  )
}

/**
 * A Company member spends only from the Company wallet, so they see that
 * wallet alone — never a personal balance. The API exposes no Company balance,
 * so the page shows the viewer's cap headroom; admins also fund the wallet and
 * track top-ups until they settle.
 */
async function CompanyWallet({ membership }: { membership: CompanyMembership }) {
  const client = await createBuyerClient()
  const isAdmin = membership.role === 'admin'
  const [balance, topUps, recent] = await Promise.all([
    client.wallet.balance(),
    isAdmin ? client.company.wallet.listPendingTopUps() : null,
    isAdmin ? client.company.purchases.list({ per_page: 10 }) : null,
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Wallet</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your purchases are paid from the {membership.company_name} wallet.
        </p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">You can spend today</p>
          <p className="text-3xl font-bold text-gray-900">
            {balance.remaining_cents === null ? 'Uncapped' : formatCents(balance.remaining_cents)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isAdmin
              ? 'Daily spend caps are set per member on the Members page.'
              : 'Your daily spend cap is set by a Company admin.'}
          </p>
        </div>
        {isAdmin ? (
          <WalletFund target="company" />
        ) : (
          <p className="text-sm text-gray-500">Only Company admins can add funds.</p>
        )}
      </div>
      {topUps && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Pending top-ups</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">
            Funds become spendable once a top-up settles — usually at once for a card, about four
            business days for a bank transfer.
          </p>
          <PendingTopUps topUps={topUps.data} />
        </div>
      )}
      {recent && (
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Company spending</h2>
            <Link
              href="/company/purchases"
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              View all
            </Link>
          </div>
          <CompanyPurchasesTable
            purchases={recent.data}
            emptyMessage="Nothing has been paid from this wallet yet."
          />
        </div>
      )}
    </div>
  )
}
