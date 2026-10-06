import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CompanyPurchasesTable from './CompanyPurchasesTable'
import type { CompanyPurchase } from '@ledewire/node'

function makePurchase(overrides: Partial<CompanyPurchase> = {}): CompanyPurchase {
  return {
    kind: 'purchase',
    id: 'pur-1',
    member: { id: 'mem-1', user_id: 'user-1', name: 'Ada', kind: 'human', left_at: null },
    status: 'completed',
    amount_cents: 250,
    occurred_at: '2026-01-15T12:00:00Z',
    ...overrides,
  }
}

describe('CompanyPurchasesTable', () => {
  it('shows an empty state', () => {
    render(<CompanyPurchasesTable purchases={[]} />)
    expect(screen.getByText(/no purchases match/i)).toBeInTheDocument()
  })

  it('renders a purchase row', () => {
    render(<CompanyPurchasesTable purchases={[makePurchase()]} />)
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Purchase')).toBeInTheDocument()
    expect(screen.getByText('$2.50')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('links bulk exports to their export page', () => {
    render(
      <CompanyPurchasesTable
        purchases={[makePurchase({ kind: 'bulk_acquisition', id: 'acq-9', status: 'acquiring' })]}
      />,
    )
    expect(screen.getByText('Bulk export')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'acq-9' })).toHaveAttribute('href', '/exports/acq-9')
  })

  it('tags machine users and members who left', () => {
    render(
      <CompanyPurchasesTable
        purchases={[
          makePurchase({
            member: {
              id: 'mem-2',
              user_id: 'user-2',
              name: 'bot',
              kind: 'machine',
              left_at: '2026-02-01T00:00:00Z',
            },
          }),
        ]}
      />,
    )
    expect(screen.getByText('machine')).toBeInTheDocument()
    expect(screen.getByText('left')).toBeInTheDocument()
  })
})
