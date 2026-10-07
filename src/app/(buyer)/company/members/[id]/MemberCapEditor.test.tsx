import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemberCapEditor from './MemberCapEditor'
import type { CompanyMember } from '@ledewire/node'

const bob: CompanyMember = {
  id: 'mem-2',
  user_id: 'user-2',
  name: 'Bob',
  email: 'bob@example.com',
  kind: 'human',
  role: 'member',
  joined_at: '2026-01-01T00:00:00Z',
  daily_spend_limit_cents: 1000,
}

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

async function saveCap(dollars: string) {
  await userEvent.click(screen.getByLabelText('Edit daily spend cap for Bob'))
  const input = screen.getByLabelText('Daily spend cap for Bob (USD)')
  await userEvent.clear(input)
  await userEvent.type(input, dollars)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
}

describe('MemberCapEditor', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the cap and today's spend against it", () => {
    render(<MemberCapEditor member={bob} todayCents={1000} />)
    expect(screen.getByLabelText('Edit daily spend cap for Bob')).toHaveTextContent('$10.00')
    expect(screen.getByText('$10.00 of $10.00 today')).toBeInTheDocument()
    expect(screen.getByText('At cap')).toBeInTheDocument()
  })

  it('saves a new cap through PATCH and reads usage against it', async () => {
    mockFetch(200, { ...bob, daily_spend_limit_cents: 2550 })
    render(<MemberCapEditor member={bob} todayCents={1000} />)
    await saveCap('25.50')
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/company/members/mem-2',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ daily_spend_limit_cents: 2550 }),
        }),
      ),
    )
    expect(await screen.findByText('$10.00 of $25.50 today')).toBeInTheDocument()
    expect(screen.getByLabelText('Edit daily spend cap for Bob')).toHaveTextContent('$25.50')
    expect(screen.queryByText('At cap')).not.toBeInTheDocument()
  })

  it('rejects a negative cap without calling the API', async () => {
    global.fetch = vi.fn()
    render(<MemberCapEditor member={bob} todayCents={0} />)
    await saveCap('-5')
    expect(screen.getByRole('alert')).toHaveTextContent(/\$0 or more/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows the API error and keeps the old cap when the update is refused', async () => {
    mockFetch(403, { error: 'Only admins can change caps' })
    render(<MemberCapEditor member={bob} todayCents={0} />)
    await saveCap('25')
    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can change caps')
    expect(screen.getByText('$0.00 of $10.00 today')).toBeInTheDocument()
  })

  it('cancels an edit', async () => {
    render(<MemberCapEditor member={bob} todayCents={0} />)
    await userEvent.click(screen.getByLabelText('Edit daily spend cap for Bob'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Daily spend cap for Bob (USD)')).not.toBeInTheDocument()
  })
})
