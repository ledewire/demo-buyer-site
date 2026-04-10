import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { config } from './config'

export interface SessionData {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}

function buildOptions(): SessionOptions {
  return {
    password: config.sessionSecret,
    cookieName: 'lw_buyer_session',
    cookieOptions: {
      secure: config.isProduction,
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  }
}

export const getSession = cache(async () => {
  return getIronSession<SessionData>(await cookies(), buildOptions())
})
