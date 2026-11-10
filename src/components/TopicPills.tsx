import { topicLabel } from '@/lib/work-labels'

interface Props {
  topics: readonly string[]
  className?: string
}

/** Topics as a list of labelled pills; nothing at all when there are none. */
export default function TopicPills({ topics, className = '' }: Props) {
  if (topics.length === 0) return null
  return (
    <ul aria-label="Topics" className={`flex flex-wrap gap-1 ${className}`}>
      {topics.map((t) => (
        <li
          key={t}
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 whitespace-nowrap"
        >
          {topicLabel(t)}
        </li>
      ))}
    </ul>
  )
}
