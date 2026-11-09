import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makePreview, makeResult, mockFetchOnce, PREVIEW } from '@/test/search-fixtures'
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
  mockFetchOnce(200, PREVIEW)
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
    mockFetchOnce(200, PREVIEW)
    const { onCancel } = renderConfirmation()
    expect(screen.getByRole('dialog')).toHaveTextContent('$1.25')
    expect(await screen.findByText('Wallet balance: $10.00')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/content/c-1/access')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('names the Company and their Remaining instead of a balance for a Company member', async () => {
    mockFetchOnce(
      200,
      makePreview({ wallet_balance_cents: null, remaining_cents: 5000, company_name: 'Acme' }),
    )
    renderConfirmation()
    expect(await screen.findByText('Charged to Acme')).toBeInTheDocument()
    expect(screen.getByText('Your remaining today: $50.00')).toBeInTheDocument()
    expect(screen.queryByText(/Wallet balance/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeEnabled()
  })

  it('tells a buyer short of funds before they confirm, with a link to /wallet', async () => {
    mockFetchOnce(
      200,
      makePreview({
        wallet_balance_cents: 50,
        has_sufficient_funds: false,
        next_required_action: 'fund_wallet',
      }),
    )
    renderConfirmation()
    expect(await screen.findByText('Wallet balance: $0.50')).toBeInTheDocument()
    expect(screen.getByText(/doesn’t cover this price/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /wallet/i })).toHaveAttribute('href', '/wallet')
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeDisabled()
  })

  it('tells a capped Company member before they confirm, with no wallet link', async () => {
    mockFetchOnce(
      200,
      makePreview({
        wallet_balance_cents: null,
        remaining_cents: 100,
        company_name: 'Acme',
        has_sufficient_funds: false,
      }),
    )
    renderConfirmation()
    expect(await screen.findByText(/doesn’t cover this price/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeDisabled()
    // A member can't fund the Company wallet, so there's nothing for them there.
    expect(screen.queryByRole('link', { name: /wallet/i })).not.toBeInTheDocument()
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
      body: JSON.stringify({ content_id: 'c-1', price_cents: 125 }),
    })
    expect(onBought).toHaveBeenCalledWith(delivery)
  })

  it('shows and quotes the price the preview gave, which affordability was judged against', async () => {
    const user = userEvent.setup()
    mockFetchOnce(200, { ...PREVIEW, price_cents: 200 })
    renderConfirmation()
    await screen.findByText('Wallet balance: $10.00')
    expect(screen.getByRole('dialog')).toHaveTextContent('Price: $2.00')

    mockFetchOnce(200, { content_type: 'markdown', content_body: 'Hot seas.' })
    await user.click(screen.getByRole('button', { name: 'Confirm purchase' }))
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/purchases',
      expect.objectContaining({ body: JSON.stringify({ content_id: 'c-1', price_cents: 200 }) }),
    )
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

  it('a refusal for a Company member shows its message without a wallet link', async () => {
    const user = userEvent.setup()
    mockFetchOnce(200, makePreview({ wallet_balance_cents: null, company_name: 'Acme' }))
    renderConfirmation()
    await screen.findByText('Charged to Acme')
    mockFetchOnce(422, { error: 'Insufficient funds', type: 'insufficient_funds' })
    await user.click(screen.getByRole('button', { name: 'Confirm purchase' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient funds')
    expect(screen.queryByRole('link', { name: /wallet/i })).not.toBeInTheDocument()
  })

  it('Confirm waits for the preview, so the buy quotes its price', async () => {
    mockFetchOnce(200, PREVIEW)
    renderConfirmation()
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeDisabled()
    await screen.findByText('Wallet balance: $10.00')
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeEnabled()
  })

  it('another refusal shows its message without a wallet link', async () => {
    await confirmWith({ error: 'Content not found' }, 404)
    expect(await screen.findByRole('alert')).toHaveTextContent('Content not found')
    expect(screen.queryByRole('link', { name: /wallet/i })).not.toBeInTheDocument()
  })

  it('a network failure says so and lets the buyer try again', async () => {
    const user = userEvent.setup()
    mockFetchOnce(200, PREVIEW)
    const { onBought } = renderConfirmation()
    await screen.findByText('Wallet balance: $10.00')
    vi.mocked(global.fetch).mockRejectedValueOnce(new TypeError('offline'))
    await user.click(screen.getByRole('button', { name: 'Confirm purchase' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error')
    expect(screen.getByRole('button', { name: 'Confirm purchase' })).toBeEnabled()
    expect(onBought).not.toHaveBeenCalled()
  })
})
