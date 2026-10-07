import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

import { mockPurchases, mockWallet } from '@/__mocks__/ledewire-client'
import DashboardPage from './page'

function page(searchParams: Record<string, string> = {}) {
  return DashboardPage({ searchParams: Promise.resolve(searchParams) })
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWallet.balance.mockResolvedValue({ balance_cents: 500 } as never)
    mockPurchases.list.mockResolvedValue({ data: [] } as never)
  })

  it('shows no invitation notice by default', async () => {
    render(await page())
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('explains why a Company invitation was refused at sign-in', async () => {
    render(await page({ invitation_refused: 'already_in_company' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'You already belong to a Company. Leave it before accepting this invitation.',
    )
  })

  it('shows only fixed text, never the query value', async () => {
    render(await page({ invitation_refused: '<b>evil</b>' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      "This invitation couldn't be accepted. Ask your Company admin to send a new one.",
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('evil')
  })
})
