import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AcquisitionResponse } from '@ledewire/node'
import ExportDetail from './ExportDetail'

const FUTURE = '2099-01-01T00:00:00Z'
const PAST = '2000-01-01T00:00:00Z'

function makeAcq(overrides: Partial<AcquisitionResponse> = {}): AcquisitionResponse {
  return {
    id: 'acq-1',
    status: 'quoted',
    quote_state: 'ready',
    publication_count: 2,
    submitted_work_count: 10,
    work_count: 8,
    quote: {
      state: 'ready',
      firm_micros: 1_234_500,
      estimated_micros: 1_500_000,
      maximum_chargeable_total_cents: 250,
      expires_at: FUTURE,
      exclusions_acknowledged_at: null,
    },
    exclusions: [{ reason: 'excluded_duplicate', count: 2 }],
    delivery: { purchased: 0, delivered: 0, undelivered: 0, outstanding: 0 },
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

function jsonResponse(status: number, body: object) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

describe('ExportDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders counts, quote and labelled exclusions', () => {
    render(<ExportDetail initialAcquisition={makeAcq()} />)
    expect(screen.getByText('quoted')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('$1.2345')).toBeInTheDocument()
    expect(screen.getByText('$1.5000')).toBeInTheDocument()
    expect(screen.getByText('$2.50')).toBeInTheDocument()
    expect(screen.getByText('Duplicate URL')).toBeInTheDocument()
  })

  it('shows pending and failed quote states', () => {
    const { rerender } = render(
      <ExportDetail initialAcquisition={makeAcq({ quote_state: 'pending' })} />,
    )
    expect(screen.getByText(/pricing your selection/i)).toBeInTheDocument()
    rerender(<ExportDetail key="failed" initialAcquisition={makeAcq({ quote_state: 'failed' })} />)
    expect(screen.getByText(/pricing failed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-quote' })).toBeInTheDocument()
  })

  it('acknowledges exclusions then offers approval', async () => {
    const acknowledged = makeAcq({
      quote: { ...makeAcq().quote, exclusions_acknowledged_at: '2026-10-01T01:00:00Z' },
    })
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, acknowledged))
    render(<ExportDetail initialAcquisition={makeAcq()} />)
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge exclusions' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/exports/acq-1/acknowledge', { method: 'POST' })
    expect(await screen.findByRole('button', { name: 'Approve & place hold' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acknowledge exclusions' })).not.toBeInTheDocument()
  })

  it('authorizes only after confirmation naming the maximum hold', async () => {
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(200, makeAcq({ status: 'acquiring', poll_after_seconds: undefined })),
    )
    const acq = makeAcq({
      quote: { ...makeAcq().quote, exclusions_acknowledged_at: '2026-10-01T01:00:00Z' },
    })
    render(<ExportDetail initialAcquisition={acq} />)
    const approve = screen.getByRole('button', { name: 'Approve & place hold' })
    await userEvent.click(approve)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(confirmSpy.mock.calls[0][0]).toContain('$2.50')
    await userEvent.click(approve)
    expect(global.fetch).toHaveBeenCalledWith('/api/exports/acq-1/authorize', { method: 'POST' })
    expect(await screen.findByText('acquiring')).toBeInTheDocument()
  })

  it('offers re-quote instead of approval when the quote expired', () => {
    const acq = makeAcq({
      quote: { ...makeAcq().quote, expires_at: PAST, exclusions_acknowledged_at: PAST },
    })
    render(<ExportDetail initialAcquisition={acq} />)
    expect(screen.getByText(/\(expired\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-quote' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
  })

  it.each([
    [{ type: 'quote_expired', error: 'x' }, /re-quote to price it/i],
    [
      { type: 'daily_spend_cap_reached', error: 'x', resets_at: '2026-10-07T00:00:00Z' },
      /daily spend cap has been reached\. it resets/i,
    ],
    [{ type: 'nothing_to_hold', error: 'x' }, /nothing to buy/i],
    [{ type: 'run_not_started', error: 'x' }, /safe to try again/i],
    [{ error: 'Something specific' }, /something specific/i],
  ])('explains refusal %o', async (body, message) => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(409, body))
    render(<ExportDetail initialAcquisition={makeAcq()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge exclusions' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('refreshes after an invalid state refusal', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse(422, { type: 'invalid_acquisition_state', error: 'x' }))
      .mockResolvedValueOnce(jsonResponse(200, makeAcq({ status: 'cancelled' })))
    render(<ExportDetail initialAcquisition={makeAcq()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge exclusions' }))
    expect(await screen.findByText('cancelled')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenLastCalledWith('/api/exports/acq-1')
  })

  it('cancels after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(200, makeAcq({ status: 'cancelled' })),
    )
    render(<ExportDetail initialAcquisition={makeAcq()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel export' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/exports/acq-1/cancel', { method: 'POST' })
    expect(await screen.findByText('cancelled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel export' })).not.toBeInTheDocument()
  })

  it('shows a network error for an action', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('offline'))
    render(<ExportDetail initialAcquisition={makeAcq()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge exclusions' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i)
  })

  it('polls at the interval the server asks for and stops when it is absent', async () => {
    vi.useFakeTimers()
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(200, makeAcq({ quote_state: 'ready' })),
    )
    render(
      <ExportDetail
        initialAcquisition={makeAcq({ quote_state: 'pending', poll_after_seconds: 5 })}
      />,
    )
    expect(screen.getByText('Updating…')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_999)
    })
    expect(global.fetch).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/exports/acq-1')
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('reports a failed refresh', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('offline'))
    render(<ExportDetail initialAcquisition={makeAcq()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not refresh/i)
  })

  describe('archive', () => {
    const settled = makeAcq({
      status: 'settled',
      delivery: { purchased: 8, delivered: 7, undelivered: 1, outstanding: 0 },
    })

    it('shows delivery counts and is hidden while quoted', () => {
      const { unmount } = render(<ExportDetail initialAcquisition={makeAcq()} />)
      expect(screen.queryByText('Archive')).not.toBeInTheDocument()
      unmount()
      vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, { state: 'pending' }))
      render(<ExportDetail initialAcquisition={settled} />)
      expect(screen.getByText('Delivered')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
    })

    it('builds the archive and polls until it is ready', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(jsonResponse(200, { state: 'pending' }))
        .mockResolvedValueOnce(jsonResponse(202, { state: 'assembling', poll_after_seconds: 1 }))
        .mockResolvedValueOnce(
          jsonResponse(200, {
            state: 'ready',
            format: 'tar_gz',
            byte_size: 2_621_440,
            expires_at: '2026-11-01T00:00:00Z',
          }),
        )
      render(<ExportDetail initialAcquisition={settled} />)
      await userEvent.click(await screen.findByRole('button', { name: 'Build archive' }))
      expect(global.fetch).toHaveBeenCalledWith('/api/exports/acq-1/corpus', { method: 'POST' })
      expect(await screen.findByText(/assembling the archive/i)).toBeInTheDocument()
      const download = await screen.findByRole(
        'link',
        { name: 'Download archive' },
        { timeout: 3000 },
      )
      expect(download).toHaveAttribute('href', '/api/exports/acq-1/download')
      expect(screen.getByText(/tar\.gz · 2\.5 MB/)).toBeInTheDocument()
    })

    it('shows the failure reason and lets the buyer retry', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        jsonResponse(200, { state: 'failed', failure_reason: 'renderer crashed' }),
      )
      render(<ExportDetail initialAcquisition={settled} />)
      expect(await screen.findByText(/assembly failed: renderer crashed/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('shows corpus errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }))
      render(<ExportDetail initialAcquisition={settled} />)
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'))
    })

    it('appears for a cancelled export that delivered some works', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, { state: 'pending' }))
      render(<ExportDetail initialAcquisition={{ ...settled, status: 'cancelled' }} />)
      expect(await screen.findByRole('button', { name: 'Build archive' })).toBeInTheDocument()
    })
  })
})
