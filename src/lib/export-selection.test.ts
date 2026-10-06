import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useExportSelection } from './export-selection'

const a = { url: 'https://a.example/1', publicationId: 'p1', publicationName: 'A' }
const b = { url: 'https://b.example/2', publicationId: 'p2', publicationName: 'B' }

describe('useExportSelection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('starts empty', () => {
    const { result } = renderHook(() => useExportSelection())
    expect(result.current.items).toEqual([])
  })

  it('adds, dedupes, checks and removes works', () => {
    const { result } = renderHook(() => useExportSelection())
    act(() => result.current.add(a))
    act(() => result.current.addMany([a, b]))
    expect(result.current.items).toEqual([a, b])
    expect(result.current.has(a.url)).toBe(true)
    act(() => result.current.remove(a.url))
    expect(result.current.items).toEqual([b])
    expect(result.current.has(a.url)).toBe(false)
  })

  it('clears the selection', () => {
    const { result } = renderHook(() => useExportSelection())
    act(() => result.current.addMany([a, b]))
    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
  })

  it('persists to sessionStorage and restores on mount', () => {
    const first = renderHook(() => useExportSelection())
    act(() => first.result.current.add(a))
    first.unmount()
    const { result } = renderHook(() => useExportSelection())
    expect(result.current.items).toEqual([a])
  })

  it('keeps mounted hooks in sync', () => {
    const one = renderHook(() => useExportSelection())
    const two = renderHook(() => useExportSelection())
    act(() => one.result.current.add(b))
    expect(two.result.current.items).toEqual([b])
  })

  it('ignores corrupt stored data', () => {
    sessionStorage.setItem('lw_export_selection', '{not json')
    const { result } = renderHook(() => useExportSelection())
    expect(result.current.items).toEqual([])
  })

  it('works in memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useExportSelection())
    expect(result.current.items).toEqual([])
    act(() => result.current.add(a))
    expect(result.current.items).toEqual([a])
  })
})
