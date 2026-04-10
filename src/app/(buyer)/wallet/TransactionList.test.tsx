import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TransactionList from './TransactionList'
import type { WalletTransactionItem } from '@ledewire/node'

function makeTx(overrides: Partial<WalletTransactionItem> = {}): WalletTransactionItem {
  return {
    id: 'tx-1',
    type: 'credit',
    reason: 'wallet_funding',
    amount_cents: 500,
    balance_after_cents: 1000,
    status: 'completed',
    reference_id: 'ref-1',
    description: 'Wallet funding',
    occurred_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('TransactionList', () => {
  it('shows empty state when there are no transactions', () => {
    render(<TransactionList transactions={[]} />)
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument()
  })

  it('renders a credit with a + prefix', () => {
    render(<TransactionList transactions={[makeTx({ amount_cents: 1000, type: 'credit' })]} />)
    expect(screen.getByText('+$10.00')).toBeInTheDocument()
  })

  it('renders a debit with a - prefix', () => {
    render(
      <TransactionList
        transactions={[makeTx({ amount_cents: 299, type: 'debit', reason: 'purchase' })]}
      />,
    )
    expect(screen.getByText('-$2.99')).toBeInTheDocument()
  })

  it('shows the balance after the transaction', () => {
    render(<TransactionList transactions={[makeTx({ balance_after_cents: 2500 })]} />)
    expect(screen.getByText('$25.00')).toBeInTheDocument()
  })

  it('shows the transaction status badge', () => {
    render(<TransactionList transactions={[makeTx({ status: 'pending' })]} />)
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it('shows the reason label', () => {
    render(<TransactionList transactions={[makeTx({ reason: 'wallet_funding' })]} />)
    expect(screen.getByText(/wallet funding/i)).toBeInTheDocument()
  })
})
