import { formatCents } from '@/lib/format'

/** A member's spend today against their daily cap, flagged once it reaches the cap. */
export default function CapUsage({
  todayCents,
  capCents,
}: {
  todayCents: number
  capCents: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span>{`${formatCents(todayCents)} of ${formatCents(capCents)} today`}</span>
      {todayCents >= capCents && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full text-red-700 bg-red-50">
          At cap
        </span>
      )}
    </div>
  )
}
