'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** One work chosen for a bulk export. */
export interface SelectedWork {
  url: string
  publicationId: string
  publicationName: string
}

const STORAGE_KEY = 'lw_export_selection'
const CHANGE_EVENT = 'lw-export-selection-change'
const EMPTY: SelectedWork[] = []

// The last raw value read from storage and its parse, so the snapshot keeps its identity
// between renders until the stored selection actually changes.
let cachedRaw: string | null = null
let cached: SelectedWork[] = EMPTY
// The selection while storage is unavailable (private mode, quota).
let inMemory: SelectedWork[] = EMPTY

function parse(raw: string | null): SelectedWork[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as SelectedWork[]) : EMPTY
  } catch {
    return EMPTY
  }
}

function read(): SelectedWork[] {
  let raw: string | null
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return inMemory
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cached = parse(raw)
  }
  return cached
}

function write(items: SelectedWork[]) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    inMemory = items
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

// No storage on the server: render empty, then restore the saved selection on hydration.
const getServerSnapshot = () => EMPTY

/**
 * The bulk-export Selection, kept in sessionStorage so it survives moving
 * between publications. Every mounted hook stays in sync via a window event.
 */
export function useExportSelection() {
  const items = useSyncExternalStore(subscribe, read, getServerSnapshot)

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
