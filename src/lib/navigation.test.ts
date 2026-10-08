import { describe, it, expect, vi } from 'vitest'
import { fullPageNavigate } from './navigation'

describe('fullPageNavigate', () => {
  it('loads the URL as a new document', () => {
    // jsdom's window.location can't be spied on, so hand in a stand-in.
    const location = { assign: vi.fn() }
    fullPageNavigate('/login', location)
    expect(location.assign).toHaveBeenCalledWith('/login')
  })
})
