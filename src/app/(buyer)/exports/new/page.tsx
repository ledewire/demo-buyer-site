import { requireAuth } from '@/lib/auth'
import ExportReview from './ExportReview'

export default async function NewExportPage() {
  await requireAuth()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New export</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review the articles you selected, then request a quote. Nothing is charged until you
          approve the quote.
        </p>
      </div>
      <ExportReview />
    </div>
  )
}
