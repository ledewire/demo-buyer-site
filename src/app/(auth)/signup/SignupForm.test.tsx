import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupForm from './SignupForm'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('@/components/GoogleSignInButton', () => ({
  default: ({
    googleClientId,
    onError,
  }: {
    googleClientId: string
    onError: (m: string) => void
  }) => (
    <button
      data-testid="google-btn"
      data-client-id={googleClientId}
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

describe('SignupForm', () => {
  beforeEach(() => {
    mockPush.mockReset()
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
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows error on failed signup', async () => {
    mockFetch(409, { error: 'Email already taken' })
    render(<SignupForm googleClientId={null} />)
    await userEvent.type(screen.getByLabelText(/full name/i), 'Alice')
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'securepassword')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Email already taken'))
    expect(mockPush).not.toHaveBeenCalled()
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
