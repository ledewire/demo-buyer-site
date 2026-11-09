import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserSpendCap } from '@ledewire/node'
import SpendCapControl from './SpendCapControl'

function makeCap(overrides: Partial<UserSpendCap> = {}): UserSpendCap {
  return {
    cap_cents: 2500,
    spend_window_timezone: 'America/New_York',
    spent_cents: 400,
    remaining_cents: 2100,
    resets_at: '2026-11-09T05:00:00Z',
    bulk_exempt: false,
    company_name: null,
    ...overrides,
  }
}

describe('SpendCapControl', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the daily agent budget and that it covers every key, not each one', () => {
    render(<SpendCapControl initialSpendCap={makeCap()} />)
    expect(screen.getByRole('heading', { name: /daily agent budget/i })).toBeInTheDocument()
    expect(screen.getByText('$25.00')).toBeInTheDocument()
    expect(
      screen.getByText(/applies to all of your api keys together, not to each key/i),
    ).toBeInTheDocument()
  })

  it("shows when today's window resets, in the spend window's timezone", () => {
    render(<SpendCapControl initialSpendCap={makeCap()} />)
    expect(screen.getByText(/resets at 12:00 AM EST \(America\/New_York\)/)).toBeInTheDocument()
  })

  it('saves a new cap in cents and shows it', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => makeCap({ cap_cents: 4050 }),
    } as Response)
    render(<SpendCapControl initialSpendCap={makeCap()} />)
    await userEvent.click(screen.getByRole('button', { name: /change daily agent budget/i }))
    const input = screen.getByLabelText(/daily agent budget \(usd\)/i)
    await userEvent.clear(input)
    await userEvent.type(input, '40.50')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.getByText('$40.50')).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/user/spend-cap', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_spend_limit_cents: 4050 }),
    })
  })

  it.each([
    ['blank', ''],
    ['negative', '-5'],
  ])('rejects a %s budget without sending a request', async (_label, typed) => {
    global.fetch = vi.fn()
    render(<SpendCapControl initialSpendCap={makeCap()} />)
    await userEvent.click(screen.getByRole('button', { name: /change daily agent budget/i }))
    const input = screen.getByLabelText(/daily agent budget \(usd\)/i)
    await userEvent.clear(input)
    if (typed) await userEvent.type(input, typed)
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a daily spend cap from $0 to $21,474,836.47',
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("shows a Company member's cap read-only, as set by the Company's admins", () => {
    render(<SpendCapControl initialSpendCap={makeCap({ company_name: 'Acme Corp' })} />)
    expect(screen.getByText('$25.00')).toBeInTheDocument()
    expect(screen.getByText(/set by acme corp's admins/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an uncapped Buyer "No limit", with a Set button that opens a blank input', async () => {
    render(
      <SpendCapControl initialSpendCap={makeCap({ cap_cents: null, remaining_cents: null })} />,
    )
    expect(screen.getByText('No limit')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /set daily agent budget/i }))
    expect(screen.getByLabelText(/daily agent budget \(usd\)/i)).toHaveValue(null)
  })

  it("shows the API's refusal and keeps the cap it had", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'A Company admin sets your daily spend cap' }),
    } as Response)
    render(<SpendCapControl initialSpendCap={makeCap()} />)
    await userEvent.click(screen.getByRole('button', { name: /change daily agent budget/i }))
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A Company admin sets your daily spend cap',
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText('$25.00')).toBeInTheDocument()
  })
})
