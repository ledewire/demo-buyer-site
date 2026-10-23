'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ContentSearchResultWithPublication } from '@ledewire/node'
import { formatCents } from '@/lib/format'
import type { Delivery } from '@/lib/purchase-delivery'
import { resultTitle } from '@/lib/search'
import ErrorAlert from './ErrorAlert'

interface Props {
  result: ContentSearchResultWithPublication
  onCancel: () => void
  onBought: (delivery: Delivery) => void
}

/** What the buy will be charged to: the buyer's wallet, or their Company. */
type Payer =
  | { kind: 'loading' }
  | { kind: 'wallet'; balanceCents: number }
  | { kind: 'company'; companyName: string }
  | { kind: 'unavailable' }

interface Refusal {
  message: string
  walletLink: boolean
}

export default function BuyConfirmation({ result, onCancel, onBought }: Props) {
  const [payer, setPayer] = useState<Payer>({ kind: 'loading' })
  const [buying, setBuying] = useState(false)
  const [refusal, setRefusal] = useState<Refusal | null>(null)

  async function confirm() {
    setRefusal(null)
    setBuying(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: result.id, price_cents: result.price_cents }),
      })
      const data = await res.json()
      if (res.ok) {
        onBought(data as Delivery)
        return
      }
      setRefusal({
        message: data.error ?? 'The purchase failed',
        // The buyer fixes these on the Wallet page: the spend cap (402) or too little money.
        walletLink: res.status === 402 || data.type === 'insufficient_funds',
      })
    } catch {
      setRefusal({ message: 'Network error — please try again', walletLink: false })
    } finally {
      setBuying(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/wallet/balance')
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setPayer({ kind: 'unavailable' })
          return
        }
        const data = await res.json()
        if (cancelled) return
        setPayer(
          data.company_name
            ? { kind: 'company', companyName: data.company_name }
            : { kind: 'wallet', balanceCents: data.balance_cents ?? 0 },
        )
      })
      .catch(() => {
        if (!cancelled) setPayer({ kind: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg space-y-4"
      >
        <h2 id="buy-title" className="text-lg font-semibold text-gray-900">
          Buy {resultTitle(result)}?
        </h2>
        <p className="text-sm text-gray-700">
          Price: <span className="font-medium">{formatCents(result.price_cents)}</span>
        </p>
        {payer.kind === 'unavailable' && (
          <p className="text-sm text-gray-500">Your balance couldn’t be loaded.</p>
        )}
        {payer.kind === 'company' && (
          <p className="text-sm text-gray-700">Charged to {payer.companyName}</p>
        )}
        {payer.kind === 'wallet' && (
          <p className="text-sm text-gray-700">Wallet balance: {formatCents(payer.balanceCents)}</p>
        )}
        {refusal && (
          <ErrorAlert>
            {refusal.message}
            {refusal.walletLink && (
              <>
                {' '}
                <Link href="/wallet" className="font-medium underline">
                  Go to your wallet
                </Link>
              </>
            )}
          </ErrorAlert>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={buying}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {buying ? 'Buying…' : 'Confirm purchase'}
          </button>
        </div>
      </div>
    </div>
  )
}
