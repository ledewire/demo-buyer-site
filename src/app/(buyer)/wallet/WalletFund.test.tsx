import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import WalletFund from './WalletFund'

vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn().mockResolvedValue(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: vi.fn(() => <div data-testid="payment-element" />),
  useStripe: vi.fn(),
  useElements: vi.fn(),
}))

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

describe('WalletFund', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(useStripe).mockReturnValue(null)
    vi.mocked(useElements).mockReturnValue(null)
  })

  it('renders a Fund wallet button initially', () => {
    render(<WalletFund />)
    expect(screen.getByRole('button', { name: /fund wallet/i })).toBeInTheDocument()
  })

  it('shows amount input after clicking Fund wallet', async () => {
    render(<WalletFund />)
    await userEvent.click(screen.getByRole('button', { name: /fund wallet/i }))
    expect(screen.getByLabelText(/amount to fund/i)).toBeInTheDocument()
  })

  it('shows error for invalid (zero) amount', async () => {
    render(<WalletFund />)
    await userEvent.click(screen.getByRole('button', { name: /fund wallet/i }))
    // leave amount empty to trigger NaN path by submitting a non-positive value via type
    const input = screen.getByLabelText(/amount to fund/i)
    await userEvent.clear(input)
    await userEvent.type(input, '-5')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByText(/valid amount/i)).toBeInTheDocument())
  })

  it('advances to Stripe form on successful session creation', async () => {
    mockFetch(200, { client_secret: 'pi_secret', session_id: 'sess_1', public_key: 'pk_test' })
    render(<WalletFund />)
    await userEvent.click(screen.getByRole('button', { name: /fund wallet/i }))
    await userEvent.type(screen.getByLabelText(/amount to fund/i), '10')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
  })

  it('mounts the Payment Element in tabs, which Stripe.js no longer defaults to', async () => {
    mockFetch(200, { client_secret: 'pi_secret', session_id: 'sess_1', public_key: 'pk_test' })
    render(<WalletFund />)
    await userEvent.click(screen.getByRole('button', { name: /fund wallet/i }))
    await userEvent.type(screen.getByLabelText(/amount to fund/i), '10')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByTestId('payment-element')
    expect(vi.mocked(PaymentElement).mock.lastCall?.[0]).toEqual({ options: { layout: 'tabs' } })
  })

  it('shows error when session creation fails', async () => {
    mockFetch(500, { error: 'Internal server error' })
    render(<WalletFund />)
    await userEvent.click(screen.getByRole('button', { name: /fund wallet/i }))
    await userEvent.type(screen.getByLabelText(/amount to fund/i), '10')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByText(/internal server error/i)).toBeInTheDocument())
  })

  it('labels the button Add funds for the Company wallet', () => {
    render(<WalletFund target="company" />)
    expect(screen.getByRole('button', { name: /add funds/i })).toBeInTheDocument()
  })

  it('creates a Company payment session for the Company target', async () => {
    mockFetch(200, { client_secret: 'pi_secret', session_id: 'sess_1', public_key: 'pk_test' })
    render(<WalletFund target="company" />)
    await userEvent.click(screen.getByRole('button', { name: /add funds/i }))
    await userEvent.type(screen.getByLabelText(/amount to fund/i), '25')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/company/wallet/payment-session',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amount_cents: 2500, currency: 'usd' }),
      }),
    )
  })

  it('returns to idle on Cancel', async () => {
    render(<WalletFund />)
    await userEvent.click(screen.getByRole('button', { name: /fund wallet/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByRole('button', { name: /fund wallet/i })).toBeInTheDocument()
  })

  describe('confirming the payment', () => {
    const elements = { elements: true }
    const confirmPayment = vi.fn()
    const reload = vi.fn()

    beforeEach(() => {
      confirmPayment.mockReset()
      reload.mockReset()
      vi.mocked(useStripe).mockReturnValue({ confirmPayment } as never)
      vi.mocked(useElements).mockReturnValue(elements as never)
      vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: 'http://localhost/wallet',
        reload,
      })
    })

    async function openPaymentForm(target: 'personal' | 'company', ...statusBodies: object[]) {
      const fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          client_secret: 'pi_secret',
          session_id: 'sess_1',
          public_key: 'pk_test',
        }),
      } as Response)
      for (const body of statusBodies) {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => body } as Response)
      }
      global.fetch = fetch
      render(<WalletFund target={target} />)
      await userEvent.click(screen.getByRole('button', { name: /fund wallet|add funds/i }))
      await userEvent.type(screen.getByLabelText(/amount to fund/i), '10')
      await userEvent.click(screen.getByRole('button', { name: /continue/i }))
      await screen.findByTestId('payment-element')
    }

    it('confirms with the mounted Elements and settles a Company top-up', async () => {
      confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
      await openPaymentForm('company')
      await userEvent.click(screen.getByRole('button', { name: /confirm payment/i }))

      expect(confirmPayment).toHaveBeenCalledWith({
        elements,
        confirmParams: { return_url: 'http://localhost/wallet' },
        redirect: 'if_required',
      })
      await waitFor(() => expect(reload).toHaveBeenCalled())
      expect(screen.getByRole('button', { name: /add funds/i })).toBeInTheDocument()
    })

    it('polls the payment status of a Personal top-up until it completes', async () => {
      confirmPayment.mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
      await openPaymentForm('personal', { status: 'completed' })
      await userEvent.click(screen.getByRole('button', { name: /confirm payment/i }))

      await waitFor(() => expect(reload).toHaveBeenCalled())
      expect(global.fetch).toHaveBeenLastCalledWith('/api/wallet/payment-status/sess_1')
    })

    it("shows Stripe's error and lets the buyer retry when confirmation fails", async () => {
      confirmPayment.mockResolvedValue({ error: { message: 'Your card was declined.' } })
      await openPaymentForm('personal')
      await userEvent.click(screen.getByRole('button', { name: /confirm payment/i }))

      expect(await screen.findByText('Your card was declined.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm payment/i })).toBeEnabled()
      expect(reload).not.toHaveBeenCalled()
    })
  })
})
