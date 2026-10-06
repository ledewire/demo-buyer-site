import { describe, it, expect } from 'vitest'
import { formatCents, formatMicros, formatDate } from './format'

describe('formatCents', () => {
  it('formats cents as dollars', () => {
    expect(formatCents(1234)).toBe('$12.34')
    expect(formatCents(0)).toBe('$0.00')
  })
})

describe('formatMicros', () => {
  it('formats micro-dollars with four decimals', () => {
    expect(formatMicros(12_345_600)).toBe('$12.3456')
    expect(formatMicros(4_200)).toBe('$0.0042')
  })
})

describe('formatDate', () => {
  it('returns an em dash when absent', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  it('formats an ISO timestamp', () => {
    expect(formatDate('2026-01-15T12:00:00Z')).toBe(
      new Date('2026-01-15T12:00:00Z').toLocaleDateString(),
    )
  })
})
