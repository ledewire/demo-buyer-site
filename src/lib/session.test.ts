// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cookies } from 'next/headers'
import { getSession } from './session'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('./config', () => ({
  config: { sessionSecret: 'v8-fixture-secret-0123456789abcdef0123456789', isProduction: true },
}))

// Sealed by iron-session 8.0.4 through getIronSession(...).save() with this module's options
// and the secret above. Real cookies carry a 14-day expiry, so the clock is pinned to the
// moment it was sealed rather than sealing it with no expiry.
const V8_SEALED_AT = 1794270084530
const V8_COOKIE =
  'Fe26.2*1*78dea165a9ed6aed8fa037e221b39a58bf9d3a101004f06a1421a8d5d65f6552*-JV_lPT-dR-T6fnyKDUP4A*TxUXmjBbwpVnzO2R1xj6OT_sBw426zOEbxCxuJoBE67Z_9_q8_GsVcfGjptJO-eiyTp067jqx-VXXBsnHzjQOLx-jChCXFJbGVaVEaxmhJA*1795479684530*98ebc19bc187668b7ca38ac8bf2e291531f9efd15b6e25b9df6fe0ba1608f8ea*W5X6ZXV_PrtQFGZPVBjiLbqPo3VE2hiiONwCBbEZGxw~2'

function withSessionCookie(value: string) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === 'lw_buyer_session' ? { name, value } : undefined),
    set: vi.fn(),
  } as never)
}

describe('getSession', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(V8_SEALED_AT)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads a session cookie sealed by iron-session 8', async () => {
    withSessionCookie(V8_COOKIE)

    const session = await getSession()

    expect(session).toMatchObject({
      accessToken: 'at-v8',
      refreshToken: 'rt-v8',
      expiresAt: 1893456000000,
    })
  })

  it('yields a signed-out session for a cookie it cannot unseal', async () => {
    withSessionCookie(V8_COOKIE.replace('-JV_', '-XX_'))

    const session = await getSession()

    expect(session.accessToken).toBeUndefined()
  })
})
