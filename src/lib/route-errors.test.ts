import { describe, it, expect, vi } from 'vitest'
import { AuthError, LedewireError, SpendCapReachedError } from '@ledewire/node'
import { ledewireErrorResponse } from './route-errors'

describe('ledewireErrorResponse', () => {
  it('maps AuthError to 401', async () => {
    const res = ledewireErrorResponse(new AuthError('expired'), 'test')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Not authenticated' })
  })

  it('passes through a LedewireError status, message and type', async () => {
    const res = ledewireErrorResponse(
      new LedewireError('quote expired', 422, undefined, 'quote_expired' as never),
      'test',
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'quote expired', type: 'quote_expired' })
  })

  it('maps SpendCapReachedError to 402 with resets_at', async () => {
    const err = Object.assign(Object.create(SpendCapReachedError.prototype), {
      message: 'cap reached',
      statusCode: 402,
      resetsAt: '2026-01-02T00:00:00Z',
    })
    const res = ledewireErrorResponse(err, 'test')
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({
      type: 'daily_spend_cap_reached',
      resets_at: '2026-01-02T00:00:00Z',
    })
  })

  it('maps unknown errors to 500 and logs them', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = ledewireErrorResponse(new Error('boom'), 'test')
    expect(res.status).toBe(500)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
