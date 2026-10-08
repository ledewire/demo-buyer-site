'use client'

import { useState } from 'react'
import { fullPageNavigate } from '@/lib/navigation'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      // A full load, so no page cached for this session outlives it.
      fullPageNavigate('/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
    >
      {loading ? 'Logging out…' : 'Log out'}
    </button>
  )
}
