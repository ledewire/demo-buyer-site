import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupForm from './SignupForm'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

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
    render(<SignupForm />)
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('redirects to /dashboard on successful signup', async () => {
    mockFetch(201, { ok: true })
    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText(/full name/i), 'Alice')
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'securepassword')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows error on failed signup', async () => {
    mockFetch(409, { error: 'Email already taken' })
    render(<SignupForm />)
    await userEvent.type(screen.getByLabelText(/full name/i), 'Alice')
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
    await userEvent.type(screen.getByLabelText(/password/i), 'securepassword')
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Email already taken'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('shows a link to sign in', () => {
    render(<SignupForm />)
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })
})
