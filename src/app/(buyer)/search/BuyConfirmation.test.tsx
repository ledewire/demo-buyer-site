import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeResult, mockFetchOnce, WALLET } from '@/test/search-fixtures'
import BuyConfirmation from './BuyConfirmation'

function renderConfirmation() {
  const onCancel = vi.fn()
  const onBought = vi.fn()
  render(<BuyConfirmation result={makeResult()} onCancel={onCancel} onBought={onBought} />)
  return { onCancel, onBought }
}

/** Opens the confirmation for a $10.00 wallet and confirms, answering the buy with `body`. */
async function confirmWith(body: object, status = 200) {
  const user = userEvent.setup()
  mockFetchOnce(200, WALLET)
  const handlers = renderConfirmation()
  await screen.findByText('Wallet balance: $10.00')
  mockFetchOnce(status, body)
  await user.click(screen.getByRole('button', { name: 'Confirm purchase' }))
  return handlers
}

describe('BuyConfirmation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  it('shows the price and wallet balance; Cancel buys nothing', async () => {
    const user = userEvent.setup()
    mockFetchOnce(200, WALLET)
    const { onCancel } = renderConfirmation()
    expect(screen.getByRole('dialog')).toHaveTextContent('$1.25')
    expect(await screen.findByText('Wallet balance: $10.00')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/wallet/balance')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('names the Company instead of a balance for a Company member', async () => {
    mockFetchOnce(200, { balance_cents: null, remaining_cents: 5000, company_name: 'Acme' })
    renderConfirmation()
    expect(await screen.findByText('Charged to Acme')).toBeInTheDocument()
    expect(screen.queryByText(/Wallet balance/)).not.toBeInTheDocument()
  })

  it('says so when the balance can’t be loaded', async () => {
    mockFetchOnce(500, { error: 'boom' })
    renderConfirmation()
    expect(await screen.findByText('Your balance couldn’t be loaded.')).toBeInTheDocument()
  })

  it('confirming buys the work and hands over what was delivered', async () => {
    const delivery = { content_type: 'markdown', content_body: 'Hot seas.' }
    const { onBought } = await confirmWith(delivery)
    expect(global.fetch).toHaveBeenCalledWith('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: 'c-1' }),
    })
    expect(onBought).toHaveBeenCalledWith(delivery)
  })

  it.each([
    [402, { error: 'Daily spend cap reached', type: 'daily_spend_cap_reached' }],
    [422, { error: 'Insufficient funds', type: 'insufficient_funds' }],
  ])('a %i refusal shows its message with a link to /wallet', async (status, body) => {
    const { onBought } = await confirmWith(body, status)
    expect(await screen.findByRole('alert')).toHaveTextContent(body.error)
    expect(screen.getByRole('link', { name: /wallet/i })).toHaveAttribute('href', '/wallet')
    expect(onBought).not.toHaveBeenCalled()
  })

  it('another refusal shows its message without a wallet link', async () => {
    await confirmWith({ error: 'Content not found' }, 404)
    expect(await screen.findByRole('alert')).toHaveTextContent('Content not found')
    expect(screen.queryByRole('link', { name: /wallet/i })).not.toBeInTheDocument()
  })

  it('a network failure says so and lets the buyer try again', async () => {
    const user = userEvent.setup()
    mockFetchOnce(200, WALLET)
    const { onBought } = renderConfirmation()
    await screen.findByText('Wallet balance: $10.00')
    vi.mocked(global.fetch).mockRejectedValueOnce(new TypeError('offline'))
    await user.click(screen.getByRole('button', { name: 'Confirm purchase' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error')
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeEnabled()
    expect(onBought).not.toHaveBeenCalled()
  })
})
