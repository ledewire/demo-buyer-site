import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PurchasesList from './PurchasesList'
import type { PurchaseResponse } from '@ledewire/node'

function makePurchase(overrides: Partial<PurchaseResponse> = {}): PurchaseResponse {
  return {
    id: 'p-1',
    content_id: 'c-1',
    content: { id: 'c-1', content_type: 'markdown', title: 'Article Title' },
    buyer_id: 'b-1',
    buyer: { id: 'b-1', name: 'Alice' },
    seller_id: 's-1',
    seller: { id: 's-1', name: 'ACME News' },
    amount_cents: 499,
    timestamp: '2026-01-15T10:00:00Z',
    status: 'completed',
    ...overrides,
  }
}

describe('PurchasesList', () => {
  it('shows empty state when there are no purchases', () => {
    render(<PurchasesList purchases={[]} />)
    expect(screen.getByText(/no purchases yet/i)).toBeInTheDocument()
  })

  it('renders purchase title and seller name', () => {
    render(<PurchasesList purchases={[makePurchase()]} />)
    expect(screen.getByText('Article Title')).toBeInTheDocument()
    expect(screen.getByText('ACME News')).toBeInTheDocument()
  })

  it('formats cents as dollars', () => {
    render(<PurchasesList purchases={[makePurchase({ amount_cents: 999 })]} />)
    expect(screen.getByText('$9.99')).toBeInTheDocument()
  })

  it('renders the purchase status badge', () => {
    render(<PurchasesList purchases={[makePurchase()]} />)
    expect(screen.getByText('completed')).toBeInTheDocument()
  })

  it('renders multiple purchases', () => {
    render(
      <PurchasesList
        purchases={[
          makePurchase({
            id: 'p-1',
            content_id: 'c-1',
            content: { id: 'c-1', content_type: 'markdown', title: 'Article 1' },
          }),
          makePurchase({
            id: 'p-2',
            content_id: 'c-2',
            content: { id: 'c-2', content_type: 'markdown', title: 'Article 2' },
          }),
        ]}
      />,
    )
    expect(screen.getByText('Article 1')).toBeInTheDocument()
    expect(screen.getByText('Article 2')).toBeInTheDocument()
  })
})
