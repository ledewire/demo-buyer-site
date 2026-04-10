import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NavBar from './NavBar'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('NavBar', () => {
  it('renders all nav links', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Wallet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Purchases' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'API Keys' })).toBeInTheDocument()
  })

  it('shows the LedeWire brand', () => {
    render(<NavBar />)
    expect(screen.getByText('LedeWire')).toBeInTheDocument()
  })

  it('renders a logout button', () => {
    render(<NavBar />)
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })
})
