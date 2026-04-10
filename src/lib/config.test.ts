import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws when SESSION_SECRET is missing', async () => {
    delete process.env.SESSION_SECRET
    await expect(() => import('./config')).rejects.toThrow('SESSION_SECRET')
  })

  it('throws when SESSION_SECRET is shorter than 32 chars', async () => {
    process.env.SESSION_SECRET = 'tooshort'
    await expect(() => import('./config')).rejects.toThrow('32 characters')
  })

  it('builds config with valid SESSION_SECRET', async () => {
    process.env.SESSION_SECRET = 'a'.repeat(32)
    const { config } = await import('./config')
    expect(config.sessionSecret).toBe('a'.repeat(32))
    expect(config.ledewireBaseUrl).toBe('https://api.ledewire.com')
  })
})
