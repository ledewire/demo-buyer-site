import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MachinesManager from './MachinesManager'
import type { CompanyMember } from '@ledewire/node'
import type { MemberActivity } from '@/lib/company-activity'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

function makeMachine(overrides: Partial<CompanyMember> = {}): CompanyMember {
  return {
    id: 'mem-2',
    user_id: 'user-2',
    name: 'research-agent',
    email: null,
    kind: 'machine',
    role: 'member',
    joined_at: '2026-01-01T00:00:00Z',
    daily_spend_limit_cents: 1000,
    ...overrides,
  }
}

function mockFetch(status: number, body: object) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

function renderManager(machines = [makeMachine()], activity: Record<string, MemberActivity> = {}) {
  return render(
    <MachinesManager initialMachines={machines} currentMembershipId="mem-1" activity={activity} />,
  )
}

function rowFor(name: string) {
  return screen.getByText(name).closest('tr')!
}

describe('MachinesManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockRefresh.mockReset()
  })

  it('labels machine users and offers no role control', () => {
    renderManager()
    expect(within(rowFor('research-agent')).getByText('Machine user')).toBeInTheDocument()
    expect(screen.queryByLabelText('Role for research-agent')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no machines', () => {
    renderManager([])
    expect(screen.getByText('No machine users yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it("links each machine's name to its detail page by membership id", () => {
    renderManager([makeMachine({ id: 'mem/3' })])
    expect(screen.getByRole('link', { name: 'research-agent' })).toHaveAttribute(
      'href',
      '/company/members/mem%2F3',
    )
  })

  it("shows each machine's spend today against its cap, and over 30 days", () => {
    renderManager(undefined, { 'mem-2': { todayCents: 1000, last30Cents: 4500 } })
    const row = rowFor('research-agent')
    expect(within(row).getByText('$10.00 of $10.00 today')).toBeInTheDocument()
    expect(within(row).getByText('At cap')).toBeInTheDocument()
    expect(within(row).getByText('$45.00 last 30 days')).toBeInTheDocument()
  })

  it("saves a machine's new daily cap in cents", async () => {
    mockFetch(200, makeMachine({ daily_spend_limit_cents: 2550 }))
    renderManager()
    await userEvent.click(screen.getByLabelText('Edit daily spend cap for research-agent'))
    const input = screen.getByLabelText('Daily spend cap for research-agent (USD)')
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

  it('warns that removing a machine is permanent and revokes its keys', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch(200, { ok: true })
    renderManager()
    await userEvent.click(within(rowFor('research-agent')).getByRole('button', { name: 'Remove' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/permanent/i))
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/revokes all of its keys/i))
    await waitFor(() => expect(screen.queryByText('research-agent')).not.toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/company/members/mem-2', { method: 'DELETE' })
  })

  it('offers no invite form', () => {
    renderManager()
    expect(screen.queryByRole('button', { name: 'Send invitation' })).not.toBeInTheDocument()
  })

  describe('adding a machine user', () => {
    function machineForm() {
      return {
        name: screen.getByLabelText('Name'),
        description: screen.getByLabelText('Description (optional)'),
        submit: screen.getByRole('button', { name: 'Add machine' }),
      }
    }

    it('posts the name and description, clears the form and refreshes the page data', async () => {
      mockFetch(201, { id: 'mu-1', name: 'research-agent' })
      renderManager()
      const form = machineForm()
      await userEvent.type(form.name, 'research-agent')
      await userEvent.type(form.description, 'Nightly crawler')
      await userEvent.click(form.submit)
      await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1))
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/company/machine-users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'research-agent', description: 'Nightly crawler' }),
        }),
      )
      expect(form.name).toHaveValue('')
      expect(form.description).toHaveValue('')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('leaves the description out when it is blank', async () => {
      mockFetch(201, { id: 'mu-1', name: 'bot' })
      renderManager()
      const form = machineForm()
      await userEvent.type(form.name, 'bot')
      await userEvent.click(form.submit)
      await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/company/machine-users',
        expect.objectContaining({ body: JSON.stringify({ name: 'bot' }) }),
      )
    })

    it('limits the name to 100 characters and requires it', () => {
      renderManager()
      const { name } = machineForm()
      expect(name).toBeRequired()
      expect(name).toHaveAttribute('maxLength', '100')
    })

    it("shows the route's error and keeps the form when adding fails", async () => {
      mockFetch(409, { error: 'A machine user named bot already exists' })
      renderManager()
      const form = machineForm()
      await userEvent.type(form.name, 'bot')
      await userEvent.click(form.submit)
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A machine user named bot already exists',
      )
      expect(form.name).toHaveValue('bot')
      expect(mockRefresh).not.toHaveBeenCalled()
    })

    it('shows a network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('offline'))
      renderManager()
      const form = machineForm()
      await userEvent.type(form.name, 'bot')
      await userEvent.click(form.submit)
      expect(await screen.findByRole('alert')).toHaveTextContent(/network error/i)
    })

    it('disables the button while the request is in flight', async () => {
      let resolve!: (res: Response) => void
      global.fetch = vi.fn().mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))
      renderManager()
      const form = machineForm()
      await userEvent.type(form.name, 'bot')
      await userEvent.click(form.submit)
      expect(form.submit).toBeDisabled()
      resolve({ ok: true, json: async () => ({ id: 'mu-1' }) } as Response)
      await waitFor(() => expect(form.submit).toBeEnabled())
    })

    it('shows the new machine when the refreshed page data arrives', () => {
      const { rerender } = renderManager()
      rerender(
        <MachinesManager
          initialMachines={[makeMachine(), makeMachine({ id: 'mem-9', name: 'nightly-bot' })]}
          currentMembershipId="mem-1"
          activity={{}}
        />,
      )
      expect(within(rowFor('nightly-bot')).getByText('$10.00')).toBeInTheDocument()
    })
  })
})
