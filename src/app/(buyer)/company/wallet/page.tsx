import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { getCompanyMembership } from '@/lib/company'
import { AuthError, LedewireError } from '@ledewire/node'
import CompanyTabs from '../CompanyTabs'
import NotInCompany from '../NotInCompany'
import PendingTopUps from './PendingTopUps'
import WalletFund from '../../wallet/WalletFund'

/**
 * Where a Company admin funds the Company wallet and follows top-ups until
 * they settle. The API exposes no Company balance yet (ledewire/api#1195).
 */
export default async function CompanyWalletPage() {
  await requireAuth()

  try {
    const membership = await getCompanyMembership()
    if (!membership) {
      return <NotInCompany />
    }
    if (membership.role !== 'admin') {
      return (
        <p className="text-sm text-gray-500">Only Company admins can manage the Company wallet.</p>
      )
    }

    const client = await createBuyerClient()
    const topUps = await client.company.wallet.listPendingTopUps()

    return (
      <div className="space-y-8">
        <CompanyTabs current="wallet" />
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Wallet</h1>
            <p className="mt-1 text-sm text-gray-500">
              Every member&apos;s purchases are paid from the {membership.company_name} wallet.
            </p>
          </div>
          <WalletFund target="company" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Pending top-ups</h2>
          <p className="mt-1 mb-4 text-sm text-gray-500">
            Funds become spendable once a top-up settles — usually at once for a card, about four
            business days for a bank transfer.
          </p>
          <PendingTopUps topUps={topUps.data} />
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
