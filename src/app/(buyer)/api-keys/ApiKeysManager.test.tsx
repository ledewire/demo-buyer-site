import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApiKeysManager from './ApiKeysManager'
import type { UserApiKey } from '@ledewire/node'

function makeKey(overrides: Partial<UserApiKey> = {}): UserApiKey {
  return {
    id: 'key-1',
    name: 'My Agent',
    key: 'bktst_abc123',
    last_used_at: null,
    spending_limit_cents: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

describe('ApiKeysManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows empty state when no keys exist', () => {
    render(<ApiKeysManager initialKeys={[]} />)
    expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument()
  })

  it('renders existing keys', () => {
    render(<ApiKeysManager initialKeys={[makeKey()]} />)
    expect(screen.getByText('My Agent')).toBeInTheDocument()
    expect(screen.getByText('bktst_abc123')).toBeInTheDocument()
  })

  it('shows create form when Create API key is clicked', async () => {
    render(<ApiKeysManager initialKeys={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /create api key/i }))
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('shows new key secret on successful create', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'bktst_new', secret: 'supersecret123' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
    render(<ApiKeysManager initialKeys={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /create api key/i }))
    await userEvent.type(screen.getByLabelText(/name/i), 'New Agent')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(screen.getByText('supersecret123')).toBeInTheDocument())
  })

  it('shows error when create fails', async () => {
    mockFetch(400, { error: 'Name already exists' })
    render(<ApiKeysManager initialKeys={[]} />)
    await userEvent.click(screen.getByRole('button', { name: /create api key/i }))
    await userEvent.type(screen.getByLabelText(/name/i), 'dup')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Name already exists'))
  })

  it('formats spending limit as dollars', () => {
    render(<ApiKeysManager initialKeys={[makeKey({ spending_limit_cents: 1000 })]} />)
    expect(screen.getByText('$10.00')).toBeInTheDocument()
  })

  it('shows — for no spending limit', () => {
    render(<ApiKeysManager initialKeys={[makeKey({ spending_limit_cents: null })]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
