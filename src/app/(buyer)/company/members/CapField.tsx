'use client'

import { formatCents } from '@/lib/format'

interface Props {
  /** The member's name, for the controls' accessible labels. */
  name: string
  capCents: number
  /** The unsaved cap in dollars, or undefined when the cap isn't being edited. */
  draft: string | undefined
  /** True while a save is in flight. */
  busy: boolean
  onDraftChange: (draft: string | undefined) => void
  onSave: () => void
}

/** A member's daily spend cap: the amount, which opens a dollar input with Save and Cancel. */
export default function CapField({ name, capCents, draft, busy, onDraftChange, onSave }: Props) {
  if (draft === undefined) {
    return (
      <button
        onClick={() => onDraftChange((capCents / 100).toFixed(2))}
        className="hover:text-indigo-700 underline decoration-dotted"
        aria-label={`Edit daily spend cap for ${name}`}
      >
        {formatCents(capCents)}
      </button>
    )
  }
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-gray-500">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        aria-label={`Daily spend cap for ${name} (USD)`}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        className="block w-24 rounded-md border-gray-300 text-sm py-1"
      />
      <button
        onClick={onSave}
        disabled={busy}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => onDraftChange(undefined)}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  )
}
