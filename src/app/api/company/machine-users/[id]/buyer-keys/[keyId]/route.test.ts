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

function del(id = 'mu-1', keyId = 'bk-1') {
  return DELETE(
    new Request(`http://localhost/api/company/machine-users/${id}/buyer-keys/${keyId}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id, keyId }) },
  )
}

describe('DELETE /api/company/machine-users/:id/buyer-keys/:keyId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { machineUsers: { buyerKeys: { revoke: mockRevoke } } },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await del()
    expect(res.status).toBe(401)
    expect(mockRevoke).not.toHaveBeenCalled()
  })

  it("revokes the machine user's key and returns ok", async () => {
    mockRevoke.mockResolvedValue(undefined)
    const res = await del('mu-1', 'bk-7')
    expect(res.status).toBe(200)
    expect(mockRevoke).toHaveBeenCalledWith('mu-1', 'bk-7')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('passes a 404 through when there is no such active key', async () => {
    mockRevoke.mockRejectedValue(new NotFoundError('key not found'))
    const res = await del()
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('key not found')
  })
})
