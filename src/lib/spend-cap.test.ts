import { describe, it, expect } from 'vitest'
import { parseCapCents } from './spend-cap'

describe('parseCapCents', () => {
  it('reads dollars as whole cents', () => {
    expect(parseCapCents('25.50')).toBe(2550)
    expect(parseCapCents('0.105')).toBe(11)
    expect(parseCapCents('0')).toBe(0)
  })

  it('refuses a missing, blank, non-numeric or negative draft', () => {
    expect(parseCapCents(undefined)).toBeNull()
    expect(parseCapCents('  ')).toBeNull()
    expect(parseCapCents('abc')).toBeNull()
    expect(parseCapCents('-5')).toBeNull()
  })
})
