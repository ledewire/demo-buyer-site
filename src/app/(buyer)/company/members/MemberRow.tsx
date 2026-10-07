'use client'

import Link from 'next/link'
import type { CompanyMember } from '@ledewire/node'
import type { MemberActivity } from '@/lib/company-activity'
import { formatCents, formatDate } from '@/lib/format'

export type Role = CompanyMember['role']

interface Props {
  member: CompanyMember
  /** The member's spend today and over the last 30 days. */
  activity: MemberActivity
  /** False in tables of Machine users, which are always non-admin members. */
  showRole: boolean
  /** True when this row is the viewer's own membership, marked "(you)". */
  isCurrent: boolean
  /** True while a request for this member is in flight. */
  busy: boolean
  /** The unsaved cap in dollars, or undefined when the cap isn't being edited. */
  capDraft: string | undefined
  onRoleChange: (role: Role) => void
  onCapDraftChange: (draft: string | undefined) => void
  onSaveCap: () => void
  onRemove: () => void
}

/** One member of the Company, human or machine, in a members table. */
export default function MemberRow({
  member: m,
  activity,
  showRole,
  isCurrent,
  busy,
  capDraft,
  onRoleChange,
  onCapDraftChange,
  onSaveCap,
  onRemove,
}: Props) {
  return (
    <tr>
      <td className="px-4 py-3 text-sm text-gray-800">
        <Link
          href={`/company/members/${encodeURIComponent(m.id)}`}
          className="text-indigo-600 hover:text-indigo-800"
        >
          {m.name}
        </Link>
        {isCurrent && <span className="ml-1 text-xs text-gray-400">(you)</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {m.kind === 'machine' ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-gray-600 bg-gray-100">
            Machine user
          </span>
        ) : (
          m.email
        )}
      </td>
      {showRole && (
        <td className="px-4 py-3 text-sm">
          <select
            aria-label={`Role for ${m.name}`}
            value={m.role}
            disabled={busy}
            onChange={(e) => onRoleChange(e.target.value as Role)}
            className="block rounded-md border-gray-300 text-sm py-1"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </td>
      )}
      <td className="px-4 py-3 text-sm text-gray-800">
        {capDraft === undefined ? (
          <button
            onClick={() => onCapDraftChange((m.daily_spend_limit_cents / 100).toFixed(2))}
            className="hover:text-indigo-700 underline decoration-dotted"
            aria-label={`Edit daily spend cap for ${m.name}`}
          >
            {formatCents(m.daily_spend_limit_cents)}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={`Daily spend cap for ${m.name} (USD)`}
              value={capDraft}
              onChange={(e) => onCapDraftChange(e.target.value)}
              className="block w-24 rounded-md border-gray-300 text-sm py-1"
            />
            <button
              onClick={onSaveCap}
              disabled={busy}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => onCapDraftChange(undefined)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-800">
        <div className="flex items-center gap-2">
          <span>{`${formatCents(activity.todayCents)} of ${formatCents(m.daily_spend_limit_cents)} today`}</span>
          {activity.todayCents >= m.daily_spend_limit_cents && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-red-700 bg-red-50">
              At cap
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">{`${formatCents(activity.last30Cents)} last 30 days`}</div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(m.joined_at)}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onRemove}
          disabled={busy}
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Remove
        </button>
      </td>
    </tr>
  )
}
