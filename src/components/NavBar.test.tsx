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

  it('renders catalog and exports links', () => {
    render(<NavBar />)
    expect(screen.getByRole('link', { name: 'Catalog' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exports' })).toBeInTheDocument()
  })

  it('hides the Company link by default', () => {
    render(<NavBar />)
    expect(screen.queryByRole('link', { name: 'Company' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Members' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Company Purchases' })).not.toBeInTheDocument()
  })

  it('shows an admin a single Company link to the People tab', () => {
    render(<NavBar isCompanyAdmin />)
    expect(screen.getByRole('link', { name: 'Company' })).toHaveAttribute(
      'href',
      '/company/members',
    )
    expect(screen.queryByRole('link', { name: 'Members' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Company Purchases' })).not.toBeInTheDocument()
  })

  it('shows the LedeWire logo, linking to the dashboard', () => {
    render(<NavBar />)
    const logo = screen.getByRole('img', { name: 'LedeWire' })
    expect(logo).toHaveAttribute('src', '/ledewire-logo.png')
    expect(logo.closest('a')).toHaveAttribute('href', '/dashboard')
  })

  it('renders a logout button', () => {
    render(<NavBar />)
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
  })
})
