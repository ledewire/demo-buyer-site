import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MachineKeyManager, { type MachineKey } from './MachineKeyManager'

const API_PATH = '/api/company/machine-users/mu-1/buyer-keys'

function makeKey(overrides: Partial<MachineKey> = {}): MachineKey {
  return {
    id: 'bk-1',
    name: 'production',
    created_at: '2026-03-01T12:00:00Z',
    last_used_at: null,
    ...overrides,
  }
}

function renderManager(initialKeys: MachineKey[] = []) {
  return render(
    <MachineKeyManager title="Buyer keys" apiPath={API_PATH} initialKeys={initialKeys} />,
  )
}

function mockFetch(status: number, body: object) {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
  global.fetch = fetchMock
  return fetchMock
}

async function issueKey(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Issue key' }))
  await userEvent.type(screen.getByLabelText('Key name'), name)
  await userEvent.click(screen.getByRole('button', { name: 'Issue' }))
}

describe('MachineKeyManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists each key with its name, created date and last-used date', () => {
    renderManager([
      makeKey(),
      makeKey({ id: 'bk-2', name: 'staging', last_used_at: '2026-04-02T12:00:00Z' }),
    ])
    const table = screen.getByRole('table', { name: 'Buyer keys' })
    const [, production, staging] = within(table).getAllByRole('row')
    expect(within(production).getByText('production')).toBeInTheDocument()
    expect(
      within(production).getByText(new Date('2026-03-01T12:00:00Z').toLocaleDateString()),
    ).toBeInTheDocument()
    expect(within(production).getByText('Never')).toBeInTheDocument()
    expect(
      within(staging).getByText(new Date('2026-04-02T12:00:00Z').toLocaleDateString()),
    ).toBeInTheDocument()
  })

  it('says when there are no keys', () => {
    renderManager()
    expect(screen.getByText('No Buyer keys yet.')).toBeInTheDocument()
  })

  it("shows a new key's secret once, then lists the key once the secret is dismissed", async () => {
    const fetchMock = mockFetch(201, {
      ...makeKey({ id: 'bk-9', name: 'nightly' }),
      key: 'bktst_new',
      secret: 'f00dcafe',
    })
    renderManager()
    await issueKey('nightly')

    expect(fetchMock).toHaveBeenCalledWith(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'nightly' }),
    })
    const panel = await screen.findByRole('region', { name: 'New key secret' })
    expect(within(panel).getByText('f00dcafe')).toBeInTheDocument()
    expect(within(panel).getByText(/won.t be shown again/i)).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole('button', { name: "I've saved the secret" }))
    expect(screen.queryByText('f00dcafe')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'New key secret' })).not.toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Buyer keys' })
    expect(within(table).getByText('nightly')).toBeInTheDocument()
  })

  it('shows an issue error in an alert and shows no secret', async () => {
    mockFetch(422, { error: 'Name has already been taken' })
    renderManager()
    await issueKey('production')
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Name has already been taken'),
    )
    expect(screen.queryByRole('region', { name: 'New key secret' })).not.toBeInTheDocument()
  })

  it('revokes a key after confirmation and removes it from the list', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = mockFetch(200, { ok: true })
    renderManager([makeKey(), makeKey({ id: 'bk/2', name: 'staging' })])

    await userEvent.click(screen.getByRole('button', { name: 'Revoke staging' }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('staging'))
    expect(fetchMock).toHaveBeenCalledWith(`${API_PATH}/bk%2F2`, { method: 'DELETE' })
    await waitFor(() => expect(screen.queryByText('staging')).not.toBeInTheDocument())
    expect(screen.getByText('production')).toBeInTheDocument()
  })

  it('keeps the key and sends nothing when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = mockFetch(200, { ok: true })
    renderManager([makeKey()])
    await userEvent.click(screen.getByRole('button', { name: 'Revoke production' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('production')).toBeInTheDocument()
  })

  it('shows a revoke error in an alert and keeps the key', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch(404, { error: 'Key not found' })
    renderManager([makeKey()])
    await userEvent.click(screen.getByRole('button', { name: 'Revoke production' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Key not found'))
    expect(screen.getByText('production')).toBeInTheDocument()
  })
})
