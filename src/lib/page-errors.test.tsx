import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

import { redirect } from 'next/navigation'
import { AuthError, LedewireError } from '@ledewire/node'
import { renderFetchError } from './page-errors'

describe('renderFetchError', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to login on an AuthError', () => {
    expect(() => renderFetchError(new AuthError('expired'))).toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it("renders the API's message on a LedewireError", () => {
    render(renderFetchError(new LedewireError('Service unavailable', 503)))
    expect(screen.getByText('API error: Service unavailable')).toBeInTheDocument()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rethrows anything else', () => {
    const boom = new Error('boom')
    expect(() => renderFetchError(boom)).toThrow(boom)
    expect(redirect).not.toHaveBeenCalled()
  })
})
