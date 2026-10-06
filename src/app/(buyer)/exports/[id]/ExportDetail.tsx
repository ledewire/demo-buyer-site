'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AcquisitionResponse, CorpusResponse } from '@ledewire/node'
import { formatCents, formatDate, formatMicros } from '@/lib/format'

interface Props {
  initialAcquisition: AcquisitionResponse
}

type Action = 'acknowledge' | 'authorize' | 'requote' | 'cancel'
type Exclusion = AcquisitionResponse['exclusions'][number]

const EXCLUSION_LABELS: Record<Exclusion['reason'], string> = {
  excluded_malformed: 'Malformed URL',
  excluded_duplicate: 'Duplicate URL',
  excluded_no_rate: 'No price set by the publisher',
  excluded_free_not_supported: 'Free article (not sold in bulk)',
  excluded_not_deliverable: 'Not deliverable',
  excluded_insufficient_rights: 'Insufficient licensing rights',
  excluded_above_price_ceiling: 'Above the price ceiling',
  excluded_rate_unavailable: 'Price temporarily unavailable',
}

const STATUS_CLASSES: Record<AcquisitionResponse['status'], string> = {
  quoted: 'text-blue-700 bg-blue-50',
  authorized: 'text-indigo-700 bg-indigo-50',
  acquiring: 'text-yellow-700 bg-yellow-50',
  settled: 'text-green-700 bg-green-50',
  cancelled: 'text-gray-600 bg-gray-100',
  failed: 'text-red-700 bg-red-50',
}

interface ApiError {
  error?: string
  type?: string
  resets_at?: string
}

/** Turns a refused bulk step into guidance the buyer can act on. */
function describeError(data: ApiError): string {
  switch (data.type) {
    case 'quote_expired':
      return 'This quote has expired. Re-quote to price it at today’s rates.'
    case 'daily_spend_cap_reached':
      return data.resets_at
        ? `Your daily spend cap has been reached. It resets ${new Date(data.resets_at).toLocaleString()}.`
        : 'Your daily spend cap has been reached.'
    case 'nothing_to_hold':
      return 'Every article in this Selection was excluded, so there is nothing to buy. Start a new export from the catalog.'
    case 'run_not_started':
      return 'The export run could not start. Nothing was held — it is safe to try again.'
    case 'quote_not_ready':
      return 'The quote is not ready yet. Wait for pricing to finish.'
    case 'quote_in_progress':
      return 'A re-quote is already running. Wait for it to finish.'
    case 'exclusions_unacknowledged':
      return 'Acknowledge the exclusions before approving.'
    case 'invalid_acquisition_state':
      return 'This export changed state in the meantime. The latest status is shown below.'
    default:
      return data.error ?? 'Something went wrong'
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export default function ExportDetail({ initialAcquisition }: Props) {
  const [acq, setAcq] = useState(initialAcquisition)
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const exportUrl = `/api/exports/${encodeURIComponent(acq.id)}`

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(exportUrl)
      if (res.ok) {
        setAcq(await res.json())
      } else {
        setError(describeError(await res.json()))
      }
    } catch {
      setError('Could not refresh the export status. Use Refresh to try again.')
    }
  }, [exportUrl])

  // Poll for as long as the server asks, at the interval it asks for.
  useEffect(() => {
    if (acq.poll_after_seconds === undefined) return
    const timer = setTimeout(refresh, acq.poll_after_seconds * 1000)
    return () => clearTimeout(timer)
  }, [acq, refresh])

  async function run(action: Action) {
    setError(null)
    setBusy(action)
    try {
      const res = await fetch(`${exportUrl}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setAcq(data)
      } else {
        setError(describeError(data))
        if (data.type === 'invalid_acquisition_state') await refresh()
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setBusy(null)
    }
  }

  const { quote } = acq
  const isQuoted = acq.status === 'quoted'
  const quoteReady = acq.quote_state === 'ready'
  const expired = !!quote.expires_at && new Date(quote.expires_at).getTime() < Date.now()
  const acknowledged = !!quote.exclusions_acknowledged_at
  const maximumHold = formatCents(quote.maximum_chargeable_total_cents)

  const canAcknowledge = isQuoted && quoteReady && !expired && !acknowledged
  const canAuthorize = isQuoted && quoteReady && !expired && acknowledged
  const canRequote = isQuoted && (expired || acq.quote_state === 'failed')
  const canCancel = isQuoted || acq.status === 'authorized' || acq.status === 'acquiring'
  const runOver = acq.status === 'settled' || acq.status === 'failed' || acq.status === 'cancelled'
  const showCorpus = acq.status === 'settled' || (runOver && acq.delivery.delivered > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASSES[acq.status]}`}
        >
          {acq.status}
        </span>
        <span className="text-xs text-gray-500">Quote: {acq.quote_state}</span>
        {acq.poll_after_seconds !== undefined && (
          <span className="text-xs text-gray-500" aria-live="polite">
            Updating…
          </span>
        )}
        <button onClick={refresh} className="ml-auto text-sm text-indigo-600 hover:text-indigo-800">
          Refresh
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </p>
      )}

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Articles submitted" value={String(acq.submitted_work_count)} />
        <Stat label="Articles priced" value={String(acq.work_count)} />
        <Stat label="Publications" value={String(acq.publication_count)} />
        <Stat label="Created" value={formatDate(acq.created_at)} />
      </dl>

      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Quote</h2>
        {acq.quote_state === 'pending' ? (
          <p className="text-sm text-gray-500">Pricing your Selection…</p>
        ) : acq.quote_state === 'failed' ? (
          <p className="text-sm text-red-600">Pricing failed. Re-quote to try again.</p>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
            <QuoteRow label="Firm price" value={formatMicros(quote.firm_micros)} />
            <QuoteRow label="Estimated price" value={formatMicros(quote.estimated_micros)} />
            <QuoteRow label="Maximum hold" value={maximumHold} />
            <QuoteRow
              label="Expires"
              value={
                quote.expires_at
                  ? `${new Date(quote.expires_at).toLocaleString()}${expired ? ' (expired)' : ''}`
                  : '—'
              }
            />
          </dl>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Exclusions</h2>
        {acq.exclusions.length === 0 ? (
          <p className="text-sm text-gray-500">No articles were excluded.</p>
        ) : (
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {acq.exclusions.map((ex) => (
                <tr key={ex.reason}>
                  <td className="py-2 text-gray-800">{EXCLUSION_LABELS[ex.reason] ?? ex.reason}</td>
                  <td className="py-2 text-right font-medium text-gray-800">{ex.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {acknowledged && (
          <p className="text-xs text-gray-500">
            Acknowledged {new Date(quote.exclusions_acknowledged_at!).toLocaleString()}
          </p>
        )}
      </section>

      {(canAcknowledge || canAuthorize || canRequote || canCancel) && (
        <div className="flex flex-wrap gap-3">
          {canAcknowledge && (
            <button
              onClick={() => run('acknowledge')}
              disabled={busy !== null}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === 'acknowledge' ? 'Acknowledging…' : 'Acknowledge exclusions'}
            </button>
          )}
          {canAuthorize && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Approve this export? Up to ${maximumHold} will be held from your wallet; only what is delivered is charged.`,
                  )
                )
                  run('authorize')
              }}
              disabled={busy !== null}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              {busy === 'authorize' ? 'Approving…' : 'Approve & place hold'}
            </button>
          )}
          {canRequote && (
            <button
              onClick={() => run('requote')}
              disabled={busy !== null}
              className="px-4 py-2 rounded-md text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
            >
              {busy === 'requote' ? 'Re-quoting…' : 'Re-quote'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => {
                const message = isQuoted
                  ? 'Withdraw this quote? No money moves.'
                  : 'Cancel this export? Articles already delivered stay bought; the rest of the hold is released.'
                if (confirm(message)) run('cancel')
              }}
              disabled={busy !== null}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel export'}
            </button>
          )}
        </div>
      )}

      {acq.status !== 'quoted' && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Delivery</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <QuoteRow label="Purchased" value={String(acq.delivery.purchased)} />
            <QuoteRow label="Delivered" value={String(acq.delivery.delivered)} />
            <QuoteRow label="Undelivered" value={String(acq.delivery.undelivered)} />
            <QuoteRow label="Outstanding" value={String(acq.delivery.outstanding)} />
          </dl>
        </section>
      )}

      {showCorpus && <CorpusPanel exportUrl={exportUrl} />}
    </div>
  )
}

function CorpusPanel({ exportUrl }: { exportUrl: string }) {
  const [corpus, setCorpus] = useState<CorpusResponse | null>(null)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${exportUrl}/corpus`)
      const data = await res.json()
      if (res.ok) setCorpus(data)
      else setError(data.error ?? 'Failed to load the archive status')
    } catch {
      setError('Network error — please try again')
    }
  }, [exportUrl])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (corpus?.poll_after_seconds === undefined) return
    const timer = setTimeout(load, corpus.poll_after_seconds * 1000)
    return () => clearTimeout(timer)
  }, [corpus, load])

  async function build() {
    setError(null)
    setBuilding(true)
    try {
      const res = await fetch(`${exportUrl}/corpus`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) setCorpus(data)
      else setError(data.error ?? 'Failed to build the archive')
    } catch {
      setError('Network error — please try again')
    } finally {
      setBuilding(false)
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-900">Archive</h2>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {!corpus ? (
        !error && <p className="text-sm text-gray-500">Checking archive…</p>
      ) : corpus.state === 'ready' ? (
        <div className="space-y-2 text-sm">
          <p className="text-gray-700">
            {corpus.format === 'jsonl_gz' ? 'JSONL (gzip)' : 'tar.gz'}
            {corpus.byte_size != null && ` · ${formatBytes(corpus.byte_size)}`}
            {corpus.expires_at && ` · available until ${formatDate(corpus.expires_at)}`}
          </p>
          <a
            href={`${exportUrl}/download`}
            className="inline-flex px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Download archive
          </a>
        </div>
      ) : corpus.state === 'assembling' ? (
        <p className="text-sm text-gray-500">Assembling the archive…</p>
      ) : (
        <div className="space-y-2">
          {corpus.state === 'failed' && (
            <p className="text-sm text-red-600">
              Assembly failed{corpus.failure_reason ? `: ${corpus.failure_reason}` : ''}.
            </p>
          )}
          {corpus.state === 'rebuild_required' && (
            <p className="text-sm text-gray-600">The archive needs to be rebuilt.</p>
          )}
          <button
            onClick={build}
            disabled={building}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {building ? 'Starting…' : corpus.state === 'failed' ? 'Try again' : 'Build archive'}
          </button>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-lg font-semibold text-gray-900">{value}</dd>
    </div>
  )
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}
