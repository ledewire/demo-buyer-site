import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fullPageNavigate } from '@/lib/navigation'
import SignupForm from './SignupForm'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
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
      Sign up with Google
    </button>
  ),
}))

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText(/full name/i), 'Alice')
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
  await userEvent.type(screen.getByLabelText(/password/i), 'securepassword')
  await userEvent.click(screen.getByRole('button', { name: /create account/i }))
}

function sentBody() {
  const init = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
  return JSON.parse(init.body as string)
}

describe('SignupForm', () => {
  beforeEach(() => {
    mockPush.mockReset()
    vi.mocked(fullPageNavigate).mockReset()
  })

  it('renders name, email, and password fields', () => {
    render(<SignupForm googleClientId={null} />)
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('redirects to /dashboard on successful signup', async () => {
    mockFetch(201, { ok: true })
    render(<SignupForm googleClientId={null} />)
    await userEvent.type(screen.getByLabelText(/full name/i), 'Alice')
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'securepassword')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/dashboard'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows error on failed signup', async () => {
    mockFetch(409, { error: 'Email already taken' })
    render(<SignupForm googleClientId={null} />)
    await userEvent.type(screen.getByLabelText(/full name/i), 'Alice')
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'securepassword')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Email already taken'))
    expect(fullPageNavigate).not.toHaveBeenCalled()
  })

  it('sends no invitation tokens without them', async () => {
    mockFetch(201, { ok: true })
    render(<SignupForm googleClientId={null} />)
    await fillAndSubmit()
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/dashboard'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(sentBody()).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'securepassword',
    })
  })

  describe('with invitation tokens', () => {
    const tokens = { company_invitation_token: 'T', invitation_token: 'S' }

    it('sends the tokens with the signup', async () => {
      mockFetch(201, { ok: true })
      render(<SignupForm googleClientId={null} invitationTokens={tokens} />)
      await fillAndSubmit()
      await waitFor(() => expect(fullPageNavigate).toHaveBeenCalled())
      expect(sentBody()).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'securepassword',
        company_invitation_token: 'T',
        invitation_token: 'S',
      })
    })

    it('goes where the API says after joining a Company', async () => {
      mockFetch(201, { ok: true, redirect: '/wallet' })
      render(<SignupForm googleClientId={null} invitationTokens={tokens} />)
      await fillAndSubmit()
      await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/wallet'))
      expect(mockPush).not.toHaveBeenCalled()
    })

    it.each([
      ['expired', 'This invitation has expired. Ask your Company admin to send a new one.'],
      [
        'wrong_email',
        'This invitation was sent to a different email address. Use the address it was sent to.',
      ],
      [
        'already_in_company',
        'You already belong to a Company. Leave it before accepting this invitation.',
      ],
    ])('shows a refused invitation (%s) and stays on the form', async (reason, error) => {
      mockFetch(422, { error, type: 'invitation_not_accepted', reason })
      render(<SignupForm googleClientId={null} invitationTokens={tokens} />)
      await fillAndSubmit()
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(error))
      expect(fullPageNavigate).not.toHaveBeenCalled()
    })

    it('hands the tokens to the Google button', () => {
      render(<SignupForm googleClientId="gid_123" invitationTokens={tokens} />)
      expect(screen.getByTestId('google-btn')).toHaveAttribute(
        'data-invitation-tokens',
        JSON.stringify(tokens),
      )
    })

    it('carries the tokens onto the sign-in link', () => {
      render(<SignupForm googleClientId={null} invitationTokens={tokens} />)
      expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
        'href',
        '/login?company_invitation_token=T&invitation_token=S',
      )
    })
  })

  it('shows a link to sign in', () => {
    render(<SignupForm googleClientId={null} />)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })

  it('does not render Google button when googleClientId is null', () => {
    render(<SignupForm googleClientId={null} />)
    expect(screen.queryByTestId('google-btn')).not.toBeInTheDocument()
  })

  it('renders Google button when googleClientId is provided', () => {
    render(<SignupForm googleClientId="gid_123" />)
    expect(screen.getByTestId('google-btn')).toBeInTheDocument()
    expect(screen.getByTestId('google-btn')).toHaveAttribute('data-client-id', 'gid_123')
  })

  it('shows error when Google sign-in fails', async () => {
    render(<SignupForm googleClientId="gid_123" />)
    await userEvent.click(screen.getByTestId('google-btn'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Google sign-in failed'),
    )
  })
})
