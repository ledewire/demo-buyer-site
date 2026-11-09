import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const mockRevoke = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { DELETE } from './route'
import { NotFoundError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function revoke(id = 'mu-1', keyId = 'pk-1') {
  return DELETE(
    new Request(`http://localhost/api/company/machine-users/${id}/payment-keys/${keyId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id, keyId }) },
  )
}

describe('DELETE /api/company/machine-users/:id/payment-keys/:keyId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { machineUsers: { paymentKeys: { revoke: mockRevoke } } },
    } as never)
  })

  it('revokes the key and returns ok', async () => {
    mockRevoke.mockResolvedValue(undefined)
    const res = await revoke()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mockRevoke).toHaveBeenCalledWith('mu-1', 'pk-1')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    expect((await revoke()).status).toBe(401)
    expect(mockRevoke).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown key', async () => {
    mockRevoke.mockRejectedValue(new NotFoundError('not found'))
    expect((await revoke('mu-1', 'pk-gone')).status).toBe(404)
  })
})
