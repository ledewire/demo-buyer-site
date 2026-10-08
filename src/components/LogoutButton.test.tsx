import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fullPageNavigate } from '@/lib/navigation'
import LogoutButton from './LogoutButton'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('@/lib/navigation', () => ({ fullPageNavigate: vi.fn() }))

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)
  })

  it('renders a Log out button', () => {
    render(<LogoutButton />)
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })

  it('calls logout API and reloads into /login on click', async () => {
    render(<LogoutButton />)
    await userEvent.click(screen.getByRole('button', { name: /log out/i }))
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/login'))
    expect(mockPush).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
  })

  it('shows loading state while logging out', async () => {
    let resolveFetch!: () => void
    global.fetch = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = () => resolve({ ok: true } as Response)
      }),
    )
    render(<LogoutButton />)
    await userEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(screen.getByRole('button', { name: /logging out/i })).toBeDisabled()
    resolveFetch()
    await waitFor(() => expect(fullPageNavigate).toHaveBeenCalledWith('/login'))
  })
})
