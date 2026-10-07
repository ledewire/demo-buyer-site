import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CompanyPendingTopUp } from '@ledewire/node'
import PendingTopUps from './PendingTopUps'

function makeTopUp(overrides: Partial<CompanyPendingTopUp> = {}): CompanyPendingTopUp {
  return {
    id: 't1',
    session_id: 'sess_1',
    amount_cents: 50000,
    status: 'processing',
    initiated_by_user_id: 'u1',
    created_at: '2026-10-01T12:00:00Z',
    expected_debit_date: null,
    ...overrides,
  }
}

describe('PendingTopUps', () => {
  it('shows an empty state', () => {
    render(<PendingTopUps topUps={[]} />)
    expect(screen.getByText(/no top-ups waiting/i)).toBeInTheDocument()
  })

  it('renders amount and status label', () => {
    render(<PendingTopUps topUps={[makeTopUp({ status: 'awaiting_verification' })]} />)
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText('Awaiting verification')).toBeInTheDocument()
  })

  it('shows the expected debit date when known', () => {
    render(<PendingTopUps topUps={[makeTopUp({ expected_debit_date: '2026-10-07' })]} />)
    expect(screen.getByText(new Date('2026-10-07').toLocaleDateString())).toBeInTheDocument()
  })
})
