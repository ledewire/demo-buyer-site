import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }))

import { POST } from './route'
import { getSession } from '@/lib/session'

const mockSession = { destroy: vi.fn() }

describe('POST /api/auth/logout', () => {
  it('destroys the session and returns 200', async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession as never)
    const res = await POST()
    expect(mockSession.destroy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
