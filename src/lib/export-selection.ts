'use client'

import { useCallback, useEffect, useState } from 'react'

/** One work chosen for a bulk export. */
export interface SelectedWork {
  url: string
  publicationId: string
  publicationName: string
}

const STORAGE_KEY = 'lw_export_selection'
const CHANGE_EVENT = 'lw-export-selection-change'

function read(): SelectedWork[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as SelectedWork[]) : []
  } catch {
    return []
  }
}

function write(items: SelectedWork[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Storage unavailable (private mode, quota) — the selection lives in memory only.
  }
  window.dispatchEvent(new CustomEvent<SelectedWork[]>(CHANGE_EVENT, { detail: items }))
}

/**
 * The bulk-export Selection, kept in sessionStorage so it survives moving
 * between publications. Every mounted hook stays in sync via a window event.
 */
export function useExportSelection() {
  const [items, setItems] = useState<SelectedWork[]>([])

  useEffect(() => {
    setItems(read())
    const onChange = (e: Event) => setItems((e as CustomEvent<SelectedWork[]>).detail)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

  const addMany = useCallback((works: SelectedWork[]) => {
    const current = read()
    const known = new Set(current.map((w) => w.url))
    const next = [...current]
    for (const w of works) {
      if (!known.has(w.url)) {
        known.add(w.url)
        next.push(w)
      }
    }
    write(next)
  }, [])

  const add = useCallback((work: SelectedWork) => addMany([work]), [addMany])

  const remove = useCallback((url: string) => {
    write(read().filter((w) => w.url !== url))
  }, [])

  const clear = useCallback(() => write([]), [])

  const has = useCallback((url: string) => items.some((w) => w.url === url), [items])

  return { items, add, addMany, remove, clear, has }
}
