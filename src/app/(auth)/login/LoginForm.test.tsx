import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fullPageNavigate } from '@/lib/navigation'
import LoginForm from './LoginForm'

vi.mock('@/lib/navigation', () => ({ fullPageNavigate: vi.fn() }))
vi.mock('@/components/GoogleSignInButton', () => ({
  default: ({
    googleClientId,
    invitationTokens,
    onError,
  }: {
    googleClientId: string
    invitationTokens?: object
    onError: (m: string) => void
  }) => (
    <button
      data-testid="google-btn"
      data-client-id={googleClientId}
      data-invitation-tokens={JSON.stringify(invitationTokens ?? {})}
      onClick={() => onError('Google sign-in failed')}
    >
      Sign in with Google
    </button>
  ),
}))

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(fullPageNavigate).mockReset()
  })

  it('renders email and password fields', () => {
    render(<LoginForm googleClientId={null} />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows the LedeWire logo', () => {
    render(<LoginForm googleClientId={null} />)
    expect(screen.getByRole('img', { name: 'LedeWire' })).toHaveAttribute(
      'src',
      '/ledewire-logo.png',
    )
  })

  it('redirects to /dashboard on successful login', async () => {
    mockFetch(200, { ok: true })
    render(<LoginForm googleClientId={null} />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('stays busy while the dashboard loads', async () => {
    mockFetch(200, { ok: true })
    render(<LoginForm googleClientId={null} />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('shows error on failed login', async () => {
    mockFetch(401, { error: 'Invalid email or password' })
    render(<LoginForm googleClientId={null} />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password'),
    )
    expect(fullPageNavigate).not.toHaveBeenCalled()
  })

  describe('with invitation tokens', () => {
    const tokens = { company_invitation_token: 'T k', invitation_token: 'S' }

    async function signIn() {
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } })
      await userEvent.type(screen.getByLabelText(/password/i), 'secret123')
      await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    }

    it('takes a password sign-in to /join with the Company token prefilled', async () => {
      mockFetch(200, { ok: true })
      render(<LoginForm googleClientId={null} invitationTokens={tokens} />)
      await signIn()
      await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/join?token=T+k'))
      const init = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
      expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', password: 'secret123' })
    })

    it('lands on the dashboard with only a store token', async () => {
      mockFetch(200, { ok: true })
      render(<LoginForm googleClientId={null} invitationTokens={{ invitation_token: 'S' }} />)
      await signIn()
      await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/dashboard'))
    })

    it('hands the tokens to the Google button', () => {
      render(<LoginForm googleClientId="gid_123" invitationTokens={tokens} />)
      expect(screen.getByTestId('google-btn')).toHaveAttribute(
        'data-invitation-tokens',
        JSON.stringify(tokens),
      )
    })

    it('carries the tokens back onto the create-account link', () => {
      render(<LoginForm googleClientId={null} invitationTokens={tokens} />)
      expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
        'href',
        '/signup?company_invitation_token=T+k&invitation_token=S',
      )
    })
  })

  it('shows links to signup and forgot-password', () => {
    render(<LoginForm googleClientId={null} />)
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('does not render Google button when googleClientId is null', () => {
    render(<LoginForm googleClientId={null} />)
    expect(screen.queryByTestId('google-btn')).not.toBeInTheDocument()
  })

  it('renders Google button when googleClientId is provided', () => {
    render(<LoginForm googleClientId="gid_123" />)
    expect(screen.getByTestId('google-btn')).toBeInTheDocument()
    expect(screen.getByTestId('google-btn')).toHaveAttribute('data-client-id', 'gid_123')
  })

  it('shows error when Google sign-in fails', async () => {
    render(<LoginForm googleClientId="gid_123" />)
    await userEvent.click(screen.getByTestId('google-btn'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Google sign-in failed'),
    )
  })
})
