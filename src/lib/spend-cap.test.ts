import { describe, it, expect } from 'vitest'
import { isCapCents, parseCapCents } from './spend-cap'

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
    expect(parseCapCents('-0.001')).toBeNull()
  })

  it('accepts the largest cap the API takes and refuses one cent more', () => {
    expect(parseCapCents('21474836.47')).toBe(2147483647)
    expect(parseCapCents('21474836.48')).toBeNull()
  })
})

describe('isCapCents', () => {
  it('accepts whole cents from zero to the largest cap the API takes', () => {
    expect(isCapCents(0)).toBe(true)
    expect(isCapCents(2500)).toBe(true)
    expect(isCapCents(2147483647)).toBe(true)
  })

  it('refuses null, missing, negative, fractional, non-number and too-large caps', () => {
    for (const cap of [null, undefined, -1, 1.5, '500', Number.NaN, 2147483648]) {
      expect(isCapCents(cap)).toBe(false)
    }
  })
})
