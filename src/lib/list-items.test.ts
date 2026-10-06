import { describe, it, expect } from 'vitest'
import { listItems } from './list-items'

describe('listItems', () => {
  it('returns a plain array unchanged', () => {
    expect(listItems([1, 2])).toEqual([1, 2])
  })

  it('unwraps a paginated envelope', () => {
    expect(listItems({ data: [1, 2], pagination: { total: 2 } } as { data: number[] })).toEqual([
      1, 2,
    ])
  })
})
