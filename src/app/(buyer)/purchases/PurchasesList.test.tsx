import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PurchasesList from './PurchasesList'
import type { PaymentKey, PurchaseResponse } from '@ledewire/node'

function makePurchase(overrides: Partial<PurchaseResponse> = {}): PurchaseResponse {
  return {
    id: 'p-1',
    content_id: 'c-1',
    content: {
      id: 'c-1',
      content_type: 'markdown',
      title: 'Article Title',
      resource_url: null,
      publication: null,
      filing: null,
    },
    buyer_id: 'b-1',
    buyer: { id: 'b-1', name: 'Alice' },
    seller_id: 's-1',
    seller: { id: 's-1', name: 'ACME News' },
    amount_cents: 499,
    timestamp: '2026-01-15T10:00:00Z',
    status: 'completed',
    license: null,
    payment_key_id: null,
    ...overrides,
  }
}

const signer: PaymentKey = {
  id: 'pk-1',
  name: 'research-agent',
  public_key: 'A'.repeat(43),
  created_by_user_id: null,
  created_at: '2026-01-01T00:00:00Z',
  last_used_at: '2026-01-15T10:00:00Z',
}

describe('PurchasesList: the Payment key that paid', () => {
  it('names the key that paid, on a second line', () => {
    render(
      <PurchasesList
        purchases={[makePurchase({ payment_key_id: 'pk-1' })]}
        paymentKeys={[signer]}
      />,
    )
    expect(screen.getByText('via Payment key')).toBeInTheDocument()
    expect(screen.getByText('research-agent')).toBeInTheDocument()
    expect(screen.getByText('via Payment key').closest('td')).toHaveTextContent(
      'Article Titlevia Payment key research-agent',
    )
  })

  it('says a revoked key paid when the id is not among the active keys', () => {
    render(
      <PurchasesList
        purchases={[makePurchase({ payment_key_id: 'pk-revoked' })]}
        paymentKeys={[signer]}
      />,
    )
    expect(screen.getByText('Paid with a revoked Payment key')).toBeInTheDocument()
    expect(screen.queryByText('research-agent')).not.toBeInTheDocument()
  })

  it('says only that a Payment key paid when the key list failed to load', () => {
    render(
      <PurchasesList purchases={[makePurchase({ payment_key_id: 'pk-1' })]} paymentKeys={null} />,
    )
    expect(screen.getByText('via a Payment key')).toBeInTheDocument()
    expect(screen.getByText('Article Title')).toBeInTheDocument()
  })

  it('shows nothing extra for a purchase no Payment key paid', () => {
    render(<PurchasesList purchases={[makePurchase()]} paymentKeys={[signer]} />)
    expect(screen.getByText('Article Title').closest('td')).toHaveTextContent(/^Article Title$/)
    expect(screen.queryByText(/Payment key/)).not.toBeInTheDocument()
  })
})

describe('PurchasesList', () => {
  it('shows empty state when there are no purchases', () => {
    render(<PurchasesList paymentKeys={[]} purchases={[]} />)
    expect(screen.getByText(/no purchases yet/i)).toBeInTheDocument()
  })

  it('renders purchase title and seller name', () => {
    render(<PurchasesList paymentKeys={[]} purchases={[makePurchase()]} />)
    expect(screen.getByText('Article Title')).toBeInTheDocument()
    expect(screen.getByText('ACME News')).toBeInTheDocument()
  })

  it('formats cents as dollars', () => {
    render(<PurchasesList paymentKeys={[]} purchases={[makePurchase({ amount_cents: 999 })]} />)
    expect(screen.getByText('$9.99')).toBeInTheDocument()
  })

  it('renders the purchase status badge', () => {
    render(<PurchasesList paymentKeys={[]} purchases={[makePurchase()]} />)
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('links to the licence download when the purchase has a licence document', () => {
    render(
      <PurchasesList
        paymentKeys={[]}
        purchases={[
          makePurchase({
            id: 'p-7',
            license: {
              type: 'ON_DEMAND_LICENSE',
              permissions: ['PARTIAL_USE'],
              document_url: 'https://api.ledewire.com/v1/purchases/p-7/license_document',
            },
          }),
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Licence' })).toHaveAttribute(
      'href',
      '/api/purchases/p-7/licence',
    )
  })

  it('shows no licence link when the purchase has no licence', () => {
    render(<PurchasesList paymentKeys={[]} purchases={[makePurchase({ license: null })]} />)
    expect(screen.queryByRole('link', { name: 'Licence' })).not.toBeInTheDocument()
  })

  it('shows no licence link while the licence document is not yet captured', () => {
    render(
      <PurchasesList
        paymentKeys={[]}
        purchases={[
          makePurchase({
            license: { type: 'ON_DEMAND_LICENSE', permissions: [], document_url: null },
          }),
        ]}
      />,
    )
    expect(screen.queryByRole('link', { name: 'Licence' })).not.toBeInTheDocument()
  })

  it('renders multiple purchases', () => {
    render(
      <PurchasesList
        paymentKeys={[]}
        purchases={[
          makePurchase({
            id: 'p-1',
            content_id: 'c-1',
            content: {
              id: 'c-1',
              content_type: 'markdown',
              title: 'Article 1',
              resource_url: null,
              publication: null,
              filing: null,
            },
          }),
          makePurchase({
            id: 'p-2',
            content_id: 'c-2',
            content: {
              id: 'c-2',
              content_type: 'markdown',
              title: 'Article 2',
              resource_url: null,
              publication: null,
              filing: null,
            },
          }),
        ]}
      />,
    )
    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.getByText('Article 2')).toBeInTheDocument()
  })
})
