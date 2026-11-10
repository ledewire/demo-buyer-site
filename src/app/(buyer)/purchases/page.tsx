import { requireAuth } from '@/lib/auth'
import { createBuyerClient } from '@/lib/ledewire'
import { renderFetchError } from '@/lib/page-errors'
import { AuthError, LedewireError } from '@ledewire/node'
import Link from 'next/link'
import { getCompanyMembership } from '@/lib/company'
import { listItems } from '@/lib/list-items'
import PurchasesList from './PurchasesList'

async function loadPurchases() {
  const client = await createBuyerClient()
  const [purchases, membership, paymentKeys] = await Promise.all([
    client.purchases.list().then(listItems),
    getCompanyMembership(),
    // The key list only names the key that paid, so when the API refuses it the purchases
    // still render, saying just that a Payment key paid.
    client.user.paymentKeys.list().catch((err: unknown) => {
      if (err instanceof LedewireError && !(err instanceof AuthError)) return null
      throw err
    }),
  ])
  return { purchases, membership, paymentKeys }
}

export default async function PurchasesPage() {
  await requireAuth()

  let data: Awaited<ReturnType<typeof loadPurchases>>
  try {
    data = await loadPurchases()
  } catch (err) {
    return renderFetchError(err)
  }
  const { purchases, membership, paymentKeys } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
        <p className="mt-1 text-sm text-gray-500">
          Individual articles you&apos;ve bought. Bulk exports are listed under{' '}
          <Link href="/exports" className="text-indigo-600 hover:text-indigo-800">
            Exports
          </Link>
          {membership?.role === 'admin' && (
            <>
              , and everything {membership.company_name} paid for is in{' '}
              <Link href="/company/purchases" className="text-indigo-600 hover:text-indigo-800">
                Company Purchases
              </Link>
            </>
          )}
          .
        </p>
      </div>
      <PurchasesList purchases={purchases} paymentKeys={paymentKeys} />
    </div>
  )
}
