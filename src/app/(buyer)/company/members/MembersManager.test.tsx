import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MembersManager from './MembersManager'
import type { CompanyInvitation, CompanyMember } from '@ledewire/node'

function makeMember(overrides: Partial<CompanyMember> = {}): CompanyMember {
  return {
    id: 'mem-1',
    user_id: 'user-1',
    name: 'Ada Admin',
    email: 'ada@example.com',
    kind: 'human',
    role: 'admin',
    joined_at: '2026-01-01T00:00:00Z',
    daily_spend_limit_cents: 1000,
    ...overrides,
  }
}

function makeInvitation(overrides: Partial<CompanyInvitation> = {}): CompanyInvitation {
  return {
    id: 'inv-1',
    company_id: 'co-1',
    company_name: 'Acme',
    email: 'new@example.com',
    role: 'member',
    invited_at: '2026-01-01T00:00:00Z',
    expires_at: '2026-01-08T00:00:00Z',
    ...overrides,
  }
}

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

const bob = makeMember({ id: 'mem-2', name: 'Bob', email: 'bob@example.com', role: 'member' })

function renderManager(members = [makeMember(), bob], invitations: CompanyInvitation[] = []) {
  return render(
    <MembersManager
      initialMembers={members}
      initialInvitations={invitations}
      currentMembershipId="mem-1"
    />,
  )
}

describe('MembersManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders members with their caps and marks the viewer', () => {
    renderManager()
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
    expect(screen.getByText('(you)')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getAllByText('$10.00')).toHaveLength(2)
  })

  it('renders people and machines in separate sections', () => {
    const agent = makeMember({
      id: 'mem-3',
      user_id: 'user-3',
      kind: 'machine',
      email: null,
      name: 'research-agent',
      role: 'member',
    })
    renderManager([makeMember(), agent, bob])
    const people = screen.getByRole('region', { name: 'People' })
    const machines = screen.getByRole('region', { name: 'Machines' })
    expect(within(people).getByText('Ada Admin')).toBeInTheDocument()
    expect(within(people).getByText('Bob')).toBeInTheDocument()
    expect(within(people).queryByText('research-agent')).not.toBeInTheDocument()
    expect(within(machines).getByText('research-agent')).toBeInTheDocument()
    expect(within(machines).queryByText('Ada Admin')).not.toBeInTheDocument()
    expect(within(machines).queryByText('Bob')).not.toBeInTheDocument()
  })

  it('offers a role control for people but not machines', () => {
    renderManager([
      bob,
      makeMember({ id: 'mem-3', kind: 'machine', email: null, name: 'research-agent' }),
    ])
    expect(screen.getByLabelText('Role for Bob')).toBeInTheDocument()
    expect(screen.queryByLabelText('Role for research-agent')).not.toBeInTheDocument()
  })

  it('shows an empty state for a section with no members', () => {
    renderManager()
    const machines = screen.getByRole('region', { name: 'Machines' })
    expect(within(machines).getByText('No machine users yet.')).toBeInTheDocument()
    expect(within(machines).queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an empty People section when every member is a machine', () => {
    renderManager([makeMember({ kind: 'machine', email: null, name: 'research-agent' })])
    const people = screen.getByRole('region', { name: 'People' })
    expect(within(people).getByText('No people yet.')).toBeInTheDocument()
    expect(within(people).queryByRole('table')).not.toBeInTheDocument()
  })

  it('labels machine users', () => {
    renderManager([makeMember({ kind: 'machine', email: null, name: 'research-agent' })])
    expect(screen.getByText('Machine user')).toBeInTheDocument()
  })

  it('changes a member role', async () => {
    mockFetch(200, { ...bob, role: 'admin' })
    renderManager()
    await userEvent.selectOptions(screen.getByLabelText('Role for Bob'), 'admin')
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/company/members/mem-2',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'admin' }) }),
      ),
    )
    expect(screen.getByLabelText('Role for Bob')).toHaveValue('admin')
  })

  it('shows the API error when an update is refused', async () => {
    mockFetch(422, { error: 'Company must keep an admin' })
    renderManager()
    await userEvent.selectOptions(screen.getByLabelText('Role for Ada Admin'), 'member')
    expect(await screen.findByRole('alert')).toHaveTextContent('Company must keep an admin')
    expect(screen.getByLabelText('Role for Ada Admin')).toHaveValue('admin')
  })

  it('saves a new daily cap in cents', async () => {
    mockFetch(200, { ...bob, daily_spend_limit_cents: 2550 })
    renderManager()
    await userEvent.click(screen.getByLabelText('Edit daily spend cap for Bob'))
    const input = screen.getByLabelText('Daily spend cap for Bob (USD)')
    await userEvent.clear(input)
    await userEvent.type(input, '25.50')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/company/members/mem-2',
        expect.objectContaining({ body: JSON.stringify({ daily_spend_limit_cents: 2550 }) }),
      ),
    )
    expect(await screen.findByText('$25.50')).toBeInTheDocument()
  })

  it('rejects a negative cap without calling the API', async () => {
    global.fetch = vi.fn()
    renderManager()
    await userEvent.click(screen.getByLabelText('Edit daily spend cap for Bob'))
    const input = screen.getByLabelText('Daily spend cap for Bob (USD)')
    await userEvent.clear(input)
    await userEvent.type(input, '-5')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/\$0 or more/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('cancels a cap edit', async () => {
    renderManager()
    await userEvent.click(screen.getByLabelText('Edit daily spend cap for Bob'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('Daily spend cap for Bob (USD)')).not.toBeInTheDocument()
  })

  it('removes a member after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch(200, { ok: true })
    renderManager()
    const row = screen.getByText('Bob').closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/company/members/mem-2', { method: 'DELETE' })
  })

  it('asks with the existing wording before removing a person', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    global.fetch = vi.fn()
    renderManager()
    const row = screen.getByText('Bob').closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(confirm).toHaveBeenCalledWith('Remove Bob from the Company?')
  })

  it('warns that removing a machine is permanent and revokes its keys', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch(200, { ok: true })
    renderManager([
      makeMember(),
      makeMember({ id: 'mem-3', kind: 'machine', email: null, name: 'research-agent' }),
    ])
    const row = screen.getByText('research-agent').closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/permanent/i))
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/revokes all of its keys/i))
    await waitFor(() => expect(screen.queryByText('research-agent')).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/company/members/mem-3', { method: 'DELETE' })
  })

  it('does not remove when confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    global.fetch = vi.fn()
    renderManager()
    const row = screen.getByText('Bob').closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows an error when removal fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch(422, { error: 'would leave no admin' })
    renderManager()
    const row = screen.getByText('Ada Admin').closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('would leave no admin')
    expect(screen.getByText('Ada Admin')).toBeInTheDocument()
  })

  it('shows existing pending invitations', () => {
    renderManager(undefined, [makeInvitation()])
    expect(screen.getByText('new@example.com')).toBeInTheDocument()
  })

  it('sends an invitation and lists it', async () => {
    mockFetch(201, makeInvitation({ id: 'inv-2', email: 'carol@example.com', role: 'admin' }))
    renderManager()
    expect(screen.getByText('No pending invitations.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'carol@example.com')
    await userEvent.selectOptions(screen.getByLabelText('Role'), 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByText('carol@example.com')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/company/invitations',
      expect.objectContaining({
        body: JSON.stringify({ email: 'carol@example.com', role: 'admin' }),
      }),
    )
    expect(screen.getByLabelText('Email')).toHaveValue('')
  })

  it('shows an error when an invitation fails', async () => {
    mockFetch(409, { error: 'already a member' })
    renderManager()
    await userEvent.type(screen.getByLabelText('Email'), 'bob@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already a member')
  })

  it('shows a network error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('offline'))
    renderManager()
    await userEvent.type(screen.getByLabelText('Email'), 'x@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i)
  })
})
