import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockCreate = vi.fn()

vi.mock('@/lib/route-auth', () => ({ requireAuthForRoute: vi.fn() }))
vi.mock('@/lib/ledewire', () => ({ createBuyerClient: vi.fn() }))
vi.mock('@ledewire/node', async (importOriginal) => {
  return await importOriginal<typeof import('@ledewire/node')>()
})

import { POST } from './route'
import { AuthError, ForbiddenError, LedewireError } from '@ledewire/node'
import { requireAuthForRoute } from '@/lib/route-auth'
import { createBuyerClient } from '@/lib/ledewire'

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/company/machine-users', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/company/machine-users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuthForRoute).mockResolvedValue({})
    vi.mocked(createBuyerClient).mockResolvedValue({
      company: { machineUsers: { create: mockCreate } },
    } as never)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuthForRoute).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) as never,
    )
    const res = await POST(postRequest({ name: 'bot' }))
    expect(res.status).toBe(401)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await POST(postRequest('not json'))
    expect(res.status).toBe(400)
  })

  it.each([
    ['a missing name', {}],
    ['a non-string name', { name: 42 }],
    ['a blank name', { name: '   ' }],
    ['a name over 100 characters', { name: 'a'.repeat(101) }],
    ['a non-string description', { name: 'bot', description: 7 }],
    ['a null body', null],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await POST(postRequest(body))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toEqual(expect.any(String))
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('accepts a name of exactly 100 characters after trimming', async () => {
    mockCreate.mockResolvedValue({ id: 'mu-1' })
    const res = await POST(postRequest({ name: ` ${'a'.repeat(100)} ` }))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({ name: 'a'.repeat(100) })
  })

  it('creates a machine user with the trimmed name and returns 201', async () => {
    const machine = { id: 'mu-1', user_id: 'user-9', name: 'research-agent' }
    mockCreate.mockResolvedValue(machine)
    const res = await POST(postRequest({ name: '  research-agent  ' }))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({ name: 'research-agent' })
    expect(await res.json()).toEqual(machine)
  })

  it('passes the description through when given', async () => {
    mockCreate.mockResolvedValue({ id: 'mu-1' })
    await POST(postRequest({ name: 'bot', description: 'Nightly crawler' }))
    expect(mockCreate).toHaveBeenCalledWith({ name: 'bot', description: 'Nightly crawler' })
  })

  it('trims the description and leaves it out when blank', async () => {
    mockCreate.mockResolvedValue({ id: 'mu-1' })
    await POST(postRequest({ name: 'bot', description: '  Nightly crawler  ' }))
    expect(mockCreate).toHaveBeenLastCalledWith({ name: 'bot', description: 'Nightly crawler' })
    await POST(postRequest({ name: 'bot', description: '   ' }))
    expect(mockCreate).toHaveBeenLastCalledWith({ name: 'bot' })
  })

  it('returns 401 on AuthError', async () => {
    mockCreate.mockRejectedValue(new AuthError('expired'))
    const res = await POST(postRequest({ name: 'bot' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-admin', async () => {
    mockCreate.mockRejectedValue(new ForbiddenError('admins only'))
    const res = await POST(postRequest({ name: 'bot' }))
    expect(res.status).toBe(403)
  })

  it('passes a duplicate-name 409 through with its message', async () => {
    mockCreate.mockRejectedValue(new LedewireError('name already taken', 409))
    const res = await POST(postRequest({ name: 'bot' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('name already taken')
  })

  it('returns 500 on unexpected error', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = await POST(postRequest({ name: 'bot' }))
    expect(res.status).toBe(500)
  })
})
