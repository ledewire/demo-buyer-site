import type { ReactNode } from 'react'

/** A red, announced message for something that went wrong. */
export default function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"
    >
      {children}
    </p>
  )
}
