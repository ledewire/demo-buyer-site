import { useId } from 'react'
import Link from 'next/link'
import type { CompanyTotals, WindowTotals } from '@/lib/company-activity'
import { formatCents } from '@/lib/format'

function WindowTile({ label, totals }: { label: string; totals: WindowTotals }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="px-4 py-3">
      <p id={id} className="text-xs font-medium text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-gray-900">{formatCents(totals.spendCents)}</p>
      <p className="text-sm text-gray-500">
        {totals.purchaseCount} {totals.purchaseCount === 1 ? 'purchase' : 'purchases'}
      </p>
    </div>
  )
}

/** The Company's spend and purchase counts today, over 7 days and over 30 days. */
export default function ActivitySnapshot({ totals }: { totals: CompanyTotals }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-gray-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
        <WindowTile label="Today" totals={totals.today} />
        <WindowTile label="Last 7 days" totals={totals.last7} />
        <WindowTile label="Last 30 days" totals={totals.last30} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-gray-500">Spend counts captured amounts only, not live bulk holds.</p>
        <Link href="/company/purchases" className="text-indigo-600 hover:text-indigo-800">
          View Company purchases
        </Link>
      </div>
    </div>
  )
}
