'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ContentSearchResultWithPublication, ContentWithAccessResponse } from '@ledewire/node'
import { formatCents } from '@/lib/format'
import type { Delivery } from '@/lib/purchase-delivery'
import { resultTitle } from '@/lib/search'
import ErrorAlert from './ErrorAlert'

interface Props {
  result: ContentSearchResultWithPublication
  onCancel: () => void
  onBought: (delivery: Delivery) => void
}

/**
 * What the buy will be charged to — the buyer's wallet, or their Company — and
 * whether the preview says they can afford it (`has_sufficient_funds`).
 */
type Payer =
  | { kind: 'loading' }
  | { kind: 'wallet'; balanceCents: number; affordable: boolean }
  // A member is shown what their cap leaves today (`null` when uncapped), never the Company balance.
  | { kind: 'company'; companyName: string; remainingCents: number | null; affordable: boolean }
  | { kind: 'unavailable' }

interface Refusal {
  message: string
  walletLink: boolean
}

export default function BuyConfirmation({ result, onCancel, onBought }: Props) {
  const [payer, setPayer] = useState<Payer>({ kind: 'loading' })
  // The search result's price until the preview gives the current one.
  const [priceCents, setPriceCents] = useState(result.price_cents)
  const [buying, setBuying] = useState(false)
  const [refusal, setRefusal] = useState<Refusal | null>(null)

  // Known short before confirming: say so up front and don't offer a buy that will be refused.
  const cannotAfford = (payer.kind === 'wallet' || payer.kind === 'company') && !payer.affordable

  async function confirm() {
    setRefusal(null)
    setBuying(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_id: result.id, price_cents: priceCents }),
      })
      const data = await res.json()
      if (res.ok) {
        onBought(data as Delivery)
        return
      }
      setRefusal({
        message: data.error ?? 'The purchase failed',
        // The buyer fixes these on the Wallet page: the spend cap (402) or too little money.
        // A Company member can't fund the Company wallet, so the Wallet page can't help them.
        walletLink:
          payer.kind !== 'company' && (res.status === 402 || data.type === 'insufficient_funds'),
      })
    } catch {
      setRefusal({ message: 'Network error — please try again', walletLink: false })
    } finally {
      setBuying(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/content/${encodeURIComponent(result.id)}/access`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setPayer({ kind: 'unavailable' })
          return
        }
        const { access_info: access, price_cents }: ContentWithAccessResponse = await res.json()
        if (cancelled) return
        setPriceCents(price_cents)
        setPayer(
          access.company_name
            ? {
                kind: 'company',
                companyName: access.company_name,
                remainingCents: access.remaining_cents,
                affordable: access.has_sufficient_funds,
              }
            : {
                kind: 'wallet',
                balanceCents: access.wallet_balance_cents ?? 0,
                affordable: access.has_sufficient_funds,
              },
        )
      })
      .catch(() => {
        if (!cancelled) setPayer({ kind: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [result.id])

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
          Price: <span className="font-medium">{formatCents(priceCents)}</span>
        </p>
        {payer.kind === 'unavailable' && (
          <p className="text-sm text-gray-500">Your balance couldn’t be loaded.</p>
        )}
        {payer.kind === 'company' && (
          <>
            <p className="text-sm text-gray-700">Charged to {payer.companyName}</p>
            {payer.remainingCents !== null && (
              <p className="text-sm text-gray-700">
                Your remaining today: {formatCents(payer.remainingCents)}
              </p>
            )}
            {!payer.affordable && (
              <p className="text-sm text-red-700">Your remaining today doesn’t cover this price.</p>
            )}
          </>
        )}
        {payer.kind === 'wallet' && (
          <>
            <p className="text-sm text-gray-700">
              Wallet balance: {formatCents(payer.balanceCents)}
            </p>
            {!payer.affordable && (
              <p className="text-sm text-red-700">
                Your wallet balance doesn’t cover this price.{' '}
                <Link href="/wallet" className="font-medium underline">
                  Go to your wallet
                </Link>
              </p>
            )}
          </>
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
            disabled={buying || payer.kind === 'loading' || cannotAfford}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {buying ? 'Buying…' : 'Confirm purchase'}
          </button>
        </div>
      </div>
    </div>
  )
}
