import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JoinCompanyForm, { extractToken } from './JoinCompanyForm'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

describe('extractToken', () => {
  it('returns a bare token trimmed', () => {
    expect(extractToken('  abc123  ')).toBe('abc123')
  })

  it.each(['token', 'invitation_token', 'company_invitation_token'])(
    'reads the %s query parameter from a link',
    (name) => {
      expect(extractToken(`https://app.example.com/accept?${name}=abc123`)).toBe('abc123')
    },
  )

  it('returns null for a link without a token, or empty input', () => {
    expect(extractToken('https://app.example.com/accept')).toBeNull()
    expect(extractToken('   ')).toBeNull()
  })
})

describe('JoinCompanyForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockRefresh.mockReset()
  })

  it('prefills the token', () => {
    render(<JoinCompanyForm initialToken="abc123" />)
    expect(screen.getByLabelText(/invitation link or token/i)).toHaveValue('abc123')
  })

  it('posts the token extracted from a pasted link and shows success', async () => {
    mockFetch(200, { id: 'm1', company_name: 'Acme', role: 'admin' })
    render(<JoinCompanyForm initialToken="" />)
    await userEvent.type(
      screen.getByLabelText(/invitation link or token/i),
      'https://app.example.com/accept?token=abc123',
    )
    await userEvent.click(screen.getByRole('button', { name: /join company/i }))
    await waitFor(() => expect(screen.getByText(/joined acme as an admin/i)).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/company/invitations/accept',
      expect.objectContaining({ body: JSON.stringify({ token: 'abc123' }) }),
    )
    expect(screen.getByRole('link', { name: /manage members/i })).toHaveAttribute(
      'href',
      '/company/members',
    )
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('links a member to the Company wallet', async () => {
    mockFetch(200, { id: 'm1', company_name: 'Acme', role: 'member' })
    render(<JoinCompanyForm initialToken="abc123" />)
    await userEvent.click(screen.getByRole('button', { name: /join company/i }))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /company wallet/i })).toHaveAttribute(
        'href',
        '/wallet',
      ),
    )
  })

  it('shows an error for a link without a token, without calling the API', async () => {
    global.fetch = vi.fn()
    render(<JoinCompanyForm initialToken="" />)
    await userEvent.type(
      screen.getByLabelText(/invitation link or token/i),
      'https://app.example.com/accept',
    )
    await userEvent.click(screen.getByRole('button', { name: /join company/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't find a token/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows the API error', async () => {
    mockFetch(410, { error: 'This invitation has expired or was withdrawn.' })
    render(<JoinCompanyForm initialToken="abc123" />)
    await userEvent.click(screen.getByRole('button', { name: /join company/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/expired/i))
  })
})
