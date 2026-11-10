import { describe, it, expect, vi } from 'vitest'
import { fullPageNavigate } from './navigation'

describe('fullPageNavigate', () => {
  it('loads the URL as a new document', () => {
    // This runs under node, which has no window.location, so hand in a stand-in.
    const location = { assign: vi.fn() }
    fullPageNavigate('/login', location)
    expect(location.assign).toHaveBeenCalledWith('/login')
  })
})
