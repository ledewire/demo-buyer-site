import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PaymentKey } from '@ledewire/node'
import PaymentKeyManager from './PaymentKeyManager'

const API_PATH = '/api/payment-keys'
const PUBLIC_KEY = 'A'.repeat(43)
const PROOF = 'B'.repeat(86)

function makeKey(overrides: Partial<PaymentKey> = {}): PaymentKey {
  return {
    id: 'pk-1',
    name: 'research-agent',
    public_key: PUBLIC_KEY,
    created_by_user_id: null,
    created_at: '2026-03-01T12:00:00Z',
    last_used_at: null,
    ...overrides,
  }
}

function tenKeys() {
  return Array.from({ length: 10 }, (_, i) => makeKey({ id: `pk-${i}`, name: `agent-${i}` }))
}

function renderManager(initialKeys: PaymentKey[] = [], variant: 'buyer' | 'machine' = 'buyer') {
  return render(
    <PaymentKeyManager variant={variant} apiPath={API_PATH} initialKeys={initialKeys} />,
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

async function fillAndRegister(name = 'research-agent') {
  await userEvent.type(screen.getByLabelText('Name'), name)
  // Paste the long key and proof: typing them one keystroke at a time, a
  // re-render per character, pushed these tests past Vitest's timeout (#94).
  await userEvent.click(screen.getByLabelText('Public key'))
  await userEvent.paste(PUBLIC_KEY)
  await userEvent.click(screen.getByLabelText('Proof'))
  await userEvent.paste(PROOF)
  await userEvent.click(screen.getByRole('button', { name: 'Register key' }))
}

describe('PaymentKeyManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists each key with its name, created date and last-used date, and counts them against 10', () => {
    renderManager([
      makeKey(),
      makeKey({ id: 'pk-2', name: 'crawler', last_used_at: '2026-04-02T12:00:00Z' }),
    ])
    const table = screen.getByRole('table', { name: 'Payment keys' })
    const [, first, second] = within(table).getAllByRole('row')
    expect(within(first).getByText('research-agent')).toBeInTheDocument()
    expect(
      within(first).getByText(new Date('2026-03-01T12:00:00Z').toLocaleDateString()),
    ).toBeInTheDocument()
    expect(within(first).getByText('Never')).toBeInTheDocument()
    expect(
      within(second).getByText(new Date('2026-04-02T12:00:00Z').toLocaleDateString()),
    ).toBeInTheDocument()
    expect(screen.getByText('2 of 10')).toBeInTheDocument()
  })

  it('says when there are no keys yet', () => {
    renderManager()
    expect(screen.getByText('No Payment keys yet.')).toBeInTheDocument()
    expect(screen.getByText('0 of 10')).toBeInTheDocument()
  })

  it('never asks for a private key', () => {
    renderManager()
    expect(screen.queryByLabelText(/private/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(3)
  })

  it('registers a key with a request body of exactly { name, public_key, proof }', async () => {
    const created = makeKey({ id: 'pk-new', name: 'new-agent' })
    const fetchMock = mockFetch(201, created)
    renderManager()
    await fillAndRegister('new-agent')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(API_PATH)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toStrictEqual({
      name: 'new-agent',
      public_key: PUBLIC_KEY,
      proof: PROOF,
    })

    const table = await screen.findByRole('table', { name: 'Payment keys' })
    expect(within(table).getByText('new-agent')).toBeInTheDocument()
    expect(screen.getByText('1 of 10')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Proof')).toHaveValue('')
  })

  it.each([
    [422, 'Proof does not verify against public_key'],
    [400, "Name can't be blank"],
  ])('shows a %i refusal as a message on the register form', async (status, message) => {
    mockFetch(status, { error: message })
    renderManager()
    await fillAndRegister()
    const form = screen.getByRole('form', { name: 'Register a Payment key' })
    expect(await within(form).findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('Proof')).toHaveValue(PROOF)
  })

  it('disables the register form at 10 active keys, with a note to revoke a key first', () => {
    renderManager(tenKeys())
    expect(screen.getByText('10 of 10')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.getByLabelText('Public key')).toBeDisabled()
    expect(screen.getByLabelText('Proof')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Register key' })).toBeDisabled()
    expect(screen.getByText(/revoke a key before registering another/i)).toBeInTheDocument()
  })

  it('revokes a key after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = mockFetch(200, { ok: true })
    renderManager([makeKey(), makeKey({ id: 'pk/2', name: 'crawler' })])
    await userEvent.click(screen.getByRole('button', { name: 'Revoke crawler' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('crawler'))
    expect(fetchMock).toHaveBeenCalledWith(`${API_PATH}/pk%2F2`, { method: 'DELETE' })
    expect(await screen.findByText('1 of 10')).toBeInTheDocument()
    expect(screen.queryByText('crawler')).not.toBeInTheDocument()
  })

  it('leaves the key alone when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const fetchMock = vi.fn()
    global.fetch = fetchMock
    renderManager([makeKey()])
    await userEvent.click(screen.getByRole('button', { name: 'Revoke research-agent' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('research-agent')).toBeInTheDocument()
  })

  it('shows a failed revoke as a message', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFetch(404, { error: 'Not found' })
    renderManager([makeKey()])
    await userEvent.click(screen.getByRole('button', { name: 'Revoke research-agent' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not found')
    expect(screen.getByText('research-agent')).toBeInTheDocument()
  })

  it.each([
    ['buyer', true],
    ['machine', false],
  ] as const)('shows the %s guidance', (variant, mentionsRegister) => {
    renderManager([], variant)
    expect(screen.getAllByText(/createPaymentKeyRegistration/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/registerPaymentKey/).length > 0).toBe(mentionsRegister)
  })
})
