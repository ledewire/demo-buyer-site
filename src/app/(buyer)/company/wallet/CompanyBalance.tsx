import type { CompanyWallet } from '@ledewire/node'
import { formatCents } from '@/lib/format'

interface Props {
  wallet: CompanyWallet
}

export default function CompanyBalance({ wallet }: Props) {
  return (
    <section aria-label="Company balance">
      <p className="text-sm text-gray-500">Available</p>
      <p className="text-3xl font-bold text-gray-900">{formatCents(wallet.balance_cents)}</p>
      {wallet.held_cents > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {formatCents(wallet.held_cents)} held for bulk exports in progress
        </p>
      )}
      {wallet.pending_top_up_cents > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {formatCents(wallet.pending_top_up_cents)} on its way — see Pending top-ups below
        </p>
      )}
    </section>
  )
}
