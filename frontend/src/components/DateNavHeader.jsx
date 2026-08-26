// Save as: frontend/src/components/DateNavHeader.jsx

import { formatDateLabel } from '../lib/portUtils.js'

// Prev Day / date label / Next Day, sits above each results list so users
// can browse nearby dates without reopening the search form.
export default function DateNavHeader({ dateStr, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-100 p-2">
      <button
        onClick={onPrev}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white"
      >
        &larr; Prev Day
      </button>
      <span className="text-sm font-semibold text-gray-700">{formatDateLabel(dateStr)}</span>
      <button
        onClick={onNext}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white"
      >
        Next Day &rarr;
      </button>
    </div>
  )
}
