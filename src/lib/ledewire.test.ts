import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock createClient and capture the storage passed to it
const mockCreateClient = vi.fn()
vi.mock('@ledewire/node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ledewire/node')>()
  return { ...actual, createClient: mockCreateClient }
})

const mockSession = {
  accessToken: 'tok_access' as string | undefined,
  refreshToken: 'tok_refresh' as string | undefined,
  expiresAt: 9999999 as number | undefined,
  save: vi.fn(),
  destroy: vi.fn(),
}
const mockGetSession = vi.fn()
vi.mock('./session', () => ({ getSession: mockGetSession }))
vi.mock('./config', () => ({ config: { ledewireBaseUrl: 'https://api.ledewire.com' } }))

describe('createBuyerClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.accessToken = 'tok_access'
    mockSession.refreshToken = 'tok_refresh'
    mockSession.expiresAt = 9999999
    mockGetSession.mockResolvedValue(mockSession)
    mockCreateClient.mockReturnValue({})
  })

  it('calls createClient with the correct baseUrl', async () => {
    const { createBuyerClient } = await import('./ledewire')
    await createBuyerClient()
    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: 'https://api.ledewire.com' }),
    )
  })

  it('storage.getTokens returns tokens when session has accessToken', async () => {
    const { createBuyerClient } = await import('./ledewire')
    await createBuyerClient()
    const { storage } = mockCreateClient.mock.calls[0][0]
    const tokens = await storage.getTokens()
    expect(tokens).toEqual({
      accessToken: 'tok_access',
      refreshToken: 'tok_refresh',
      expiresAt: 9999999,
    })
  })

  it('storage.getTokens returns null when no accessToken', async () => {
    mockSession.accessToken = undefined
    const { createBuyerClient } = await import('./ledewire')
    await createBuyerClient()
    const { storage } = mockCreateClient.mock.calls[0][0]
    const tokens = await storage.getTokens()
    expect(tokens).toBeNull()
  })

  it('storage.setTokens persists tokens to session', async () => {
    const { createBuyerClient } = await import('./ledewire')
    await createBuyerClient()
    const { storage } = mockCreateClient.mock.calls[0][0]
    await storage.setTokens({ accessToken: 'new_tok', refreshToken: 'new_ref', expiresAt: 12345 })
    expect(mockSession.accessToken).toBe('new_tok')
    expect(mockSession.refreshToken).toBe('new_ref')
    expect(mockSession.expiresAt).toBe(12345)
    expect(mockSession.save).toHaveBeenCalled()
  })

  it('storage.clearTokens destroys session', async () => {
    const { createBuyerClient } = await import('./ledewire')
    await createBuyerClient()
    const { storage } = mockCreateClient.mock.calls[0][0]
    await storage.clearTokens()
    expect(mockSession.destroy).toHaveBeenCalled()
  })

  it('storage.clearTokens clears fields when destroy throws', async () => {
    mockSession.destroy.mockRejectedValueOnce(new Error('destroy failed'))
    const { createBuyerClient } = await import('./ledewire')
    await createBuyerClient()
    const { storage } = mockCreateClient.mock.calls[0][0]
    await storage.clearTokens()
    expect(mockSession.accessToken).toBeUndefined()
    expect(mockSession.refreshToken).toBeUndefined()
    expect(mockSession.expiresAt).toBeUndefined()
  })
})
