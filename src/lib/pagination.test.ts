import { describe, it, expect } from 'vitest'
import { parsePage } from './pagination'

describe('parsePage', () => {
  it('reads a positive integer page', () => {
    expect(parsePage('3')).toBe(3)
  })

  it('treats a missing page as page 1', () => {
    expect(parsePage(undefined)).toBe(1)
  })

  it.each(['', '0', '-2', '1.5', 'abc'])('falls back to page 1 for %j', (value) => {
    expect(parsePage(value)).toBe(1)
  })
})
