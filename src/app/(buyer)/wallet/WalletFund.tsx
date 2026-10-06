'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

type FundTarget = 'personal' | 'company'

function StripePaymentForm({
  sessionId,
  target,
  onSuccess,
}: {
  sessionId: string
  target: FundTarget
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed')
      setProcessing(false)
      return
    }

    // payment-status cannot see a Company session; a Company top-up is
    // tracked through the pending top-ups list until it settles instead.
    if (target === 'company') {
      onSuccess()
      return
    }

    let attempts = 0
    const poll = async () => {
      attempts++
      const res = await fetch(`/api/wallet/payment-status/${encodeURIComponent(sessionId)}`)
      const data = await res.json()
      if (data.status === 'completed') {
        onSuccess()
      } else if (data.status === 'failed' || attempts >= 12) {
        setError('Payment could not be confirmed. Please check your wallet balance.')
        setProcessing(false)
      } else {
        setTimeout(poll, 2000)
      }
    }
    poll()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
      >
        {processing ? 'Processing…' : 'Confirm payment'}
      </button>
    </form>
  )
}

type FundState = 'idle' | 'entering-amount' | 'paying'

interface Props {
  /** Which wallet to fund. A Company top-up requires a Company admin. */
  target?: FundTarget
}

export default function WalletFund({ target = 'personal' }: Props) {
  const [fundState, setFundState] = useState<FundState>('idle')
  const [amountDollars, setAmountDollars] = useState('')
  const [paymentSession, setPaymentSession] = useState<{
    client_secret: string
    session_id: string
    public_key: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const amount = parseFloat(amountDollars)
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(
        target === 'company'
          ? '/api/company/wallet/payment-session'
          : '/api/wallet/payment-session',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_cents: Math.round(amount * 100), currency: 'usd' }),
        },
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create payment session')
      } else {
        setPaymentSession(data)
        setFundState('paying')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handleSuccess() {
    setFundState('idle')
    setPaymentSession(null)
    setAmountDollars('')
    window.location.reload()
  }

  if (fundState === 'idle') {
    return (
      <button
        onClick={() => setFundState('entering-amount')}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
      >
        {target === 'company' ? 'Add funds' : 'Fund wallet'}
      </button>
    )
  }

  if (fundState === 'entering-amount') {
    return (
      <form onSubmit={handleCreateSession} className="flex items-center space-x-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            required
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            placeholder="10.00"
            aria-label="Amount to fund"
            className="pl-7 block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '…' : 'Continue'}
        </button>
        <button
          type="button"
          onClick={() => {
            setFundState('idle')
            setError(null)
          }}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </form>
    )
  }

  if (fundState === 'paying' && paymentSession) {
    const stripePromise = loadStripe(paymentSession.public_key)
    return (
      <div className="w-full max-w-md space-y-3">
        <Elements stripe={stripePromise} options={{ clientSecret: paymentSession.client_secret }}>
          <StripePaymentForm
            sessionId={paymentSession.session_id}
            target={target}
            onSuccess={handleSuccess}
          />
        </Elements>
        <button
          type="button"
          onClick={() => {
            setFundState('idle')
            setPaymentSession(null)
          }}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
      </div>
    )
  }

  return null
}
