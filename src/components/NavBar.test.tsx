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

  it('hides Company admin links by default', () => {
    render(<NavBar />)
    expect(screen.queryByRole('link', { name: 'Members' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Company Purchases' })).not.toBeInTheDocument()
  })

  it('shows Company admin links for an admin', () => {
    render(<NavBar isCompanyAdmin />)
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
      'href',
      '/company/members',
    )
    expect(screen.getByRole('link', { name: 'Company Purchases' })).toHaveAttribute(
      'href',
      '/company/purchases',
    )
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
