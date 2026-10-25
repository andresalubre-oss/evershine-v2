import { formatDateLabel } from '../lib/portUtils.js'


export default function DateNavHeader({ dateStr, onPrev, onNext, disabled, prevDisabled }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-100 p-2">
      <button
        onClick={onPrev}
        disabled={disabled || prevDisabled}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        &larr; Prev Day
      </button>
      <span className="text-sm font-semibold text-gray-700">{formatDateLabel(dateStr)}</span>
      <button
        onClick={onNext}
        disabled={disabled}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Next Day &rarr;
      </button>
    </div>
  )
}