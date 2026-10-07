import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MachineKeyManager, { type BuyerMachineKey, type McpMachineKey } from './MachineKeyManager'

const API_PATH = '/api/company/machine-users/mu-1/buyer-keys'
const MCP_API_PATH = '/api/company/machine-users/mu-1/mcp-keys'

function makeKey(overrides: Partial<BuyerMachineKey> = {}): BuyerMachineKey {
  return {
    id: 'bk-1',
    name: 'production',
    key: 'bktst_abc',
    created_at: '2026-03-01T12:00:00Z',
    last_used_at: null,
    ...overrides,
  }
}

function makeMcpKey(overrides: Partial<McpMachineKey> = {}): McpMachineKey {
  return {
    id: 'mk-1',
    label: 'research',
    key: 'mcptst_abc',
    scopes: ['mcp:search'],
    created_at: '2026-03-01T12:00:00Z',
    last_used_at: null,
    ...overrides,
  }
}

function renderManager(initialKeys: BuyerMachineKey[] = []) {
  return render(<MachineKeyManager kind="buyer" apiPath={API_PATH} initialKeys={initialKeys} />)
}

function renderMcpManager(initialKeys: McpMachineKey[] = []) {
  return render(<MachineKeyManager kind="mcp" apiPath={MCP_API_PATH} initialKeys={initialKeys} />)
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

  it('lists each key with its name, key id, created date and last-used date', () => {
    renderManager([
      makeKey(),
      makeKey({ id: 'bk-2', name: 'staging', last_used_at: '2026-04-02T12:00:00Z' }),
    ])
    const table = screen.getByRole('table', { name: 'Buyer keys' })
    const [, production, staging] = within(table).getAllByRole('row')
    expect(within(production).getByText('production')).toBeInTheDocument()
    expect(within(production).getByText('bktst_abc')).toBeInTheDocument()
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
    // The agent logs in with key and secret together; the secret alone is useless.
    expect(within(panel).getByText('bktst_new')).toBeInTheDocument()
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

describe('MachineKeyManager for MCP keys', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists each key with its label, scopes, created date and last-used date', () => {
    renderMcpManager([
      makeMcpKey(),
      makeMcpKey({
        id: 'mk-2',
        label: 'shopper',
        scopes: ['mcp:search', 'mcp:purchase'],
        last_used_at: '2026-04-02T12:00:00Z',
      }),
    ])
    const table = screen.getByRole('table', { name: 'MCP keys' })
    const [header, research, shopper] = within(table).getAllByRole('row')
    expect(within(header).getByText('Scopes')).toBeInTheDocument()
    expect(within(research).getByText('research')).toBeInTheDocument()
    expect(within(research).getByText('mcp:search')).toBeInTheDocument()
    expect(
      within(research).getByText(new Date('2026-03-01T12:00:00Z').toLocaleDateString()),
    ).toBeInTheDocument()
    expect(within(research).getByText('Never')).toBeInTheDocument()
    expect(within(shopper).getByText('mcp:search, mcp:purchase')).toBeInTheDocument()
    expect(
      within(shopper).getByText(new Date('2026-04-02T12:00:00Z').toLocaleDateString()),
    ).toBeInTheDocument()
  })

  it('will not issue a key with no scope selected', async () => {
    const fetchMock = mockFetch(201, {})
    renderMcpManager()
    await userEvent.click(screen.getByRole('button', { name: 'Issue key' }))
    await userEvent.type(screen.getByLabelText('Label'), 'research')
    const scopes = screen.getByRole('group', { name: 'Scopes' })
    for (const box of within(scopes).getAllByRole('checkbox')) {
      expect(box).not.toBeChecked()
    }
    expect(screen.getByRole('button', { name: 'Issue' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Label'), '{enter}')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('issues a key with a label and scopes, shows its secret once, then lists it', async () => {
    const fetchMock = mockFetch(201, {
      ...makeMcpKey({ id: 'mk-9', label: 'shopper', key: 'mcptst_new' }),
      scopes: ['mcp:search', 'mcp:purchase'],
      secret: 'f00dcafe',
    })
    renderMcpManager()
    await userEvent.click(screen.getByRole('button', { name: 'Issue key' }))
    await userEvent.type(screen.getByLabelText('Label'), 'shopper')
    await userEvent.click(screen.getByRole('checkbox', { name: 'mcp:search' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'mcp:purchase' }))
    await userEvent.click(screen.getByRole('button', { name: 'Issue' }))

    expect(fetchMock).toHaveBeenCalledWith(MCP_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'shopper', scopes: ['mcp:search', 'mcp:purchase'] }),
    })
    const panel = await screen.findByRole('region', { name: 'New key secret' })
    expect(within(panel).getByText('f00dcafe')).toBeInTheDocument()
    expect(within(panel).getByText('mcptst_new')).toBeInTheDocument()

    await userEvent.click(within(panel).getByRole('button', { name: "I've saved the secret" }))
    expect(screen.queryByText('f00dcafe')).not.toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'MCP keys' })
    const [, shopper] = within(table).getAllByRole('row')
    expect(within(shopper).getByText('shopper')).toBeInTheDocument()
    expect(within(shopper).getByText('mcp:search, mcp:purchase')).toBeInTheDocument()
  })

  it('revokes a key by its label after confirmation and removes it from the list', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = mockFetch(200, { ok: true })
    renderMcpManager([makeMcpKey(), makeMcpKey({ id: 'mk-2', label: 'shopper' })])

    await userEvent.click(screen.getByRole('button', { name: 'Revoke shopper' }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('shopper'))
    expect(fetchMock).toHaveBeenCalledWith(`${MCP_API_PATH}/mk-2`, { method: 'DELETE' })
    await waitFor(() => expect(screen.queryByText('shopper')).not.toBeInTheDocument())
    expect(screen.getByText('research')).toBeInTheDocument()
  })
})
