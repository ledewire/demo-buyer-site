import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginForm from './LoginForm'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

describe('LoginForm', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('renders email and password fields', () => {
    render(<LoginForm googleClientId={null} />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('redirects to /dashboard on successful login', async () => {
    mockFetch(200, { ok: true })
    render(<LoginForm googleClientId={null} />)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
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
    expect(mockPush).not.toHaveBeenCalled()
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
})
