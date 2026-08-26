// Save as: frontend/src/components/TripCard.jsx

import { CROSSING_DURATION_HOURS, formatTime } from '../lib/portUtils.js'

// One trip result — departure/arrival times with a duration line between
// them, port names, price, and a Book button. Same card used for both the
// outbound and return lists.
export default function TripCard({ schedule, fromLabel, toLabel, onBook }) {
  const departure = new Date(schedule.departureDatetime)
  const arrival = new Date(departure.getTime() + CROSSING_DURATION_HOURS * 60 * 60 * 1000)

  return (
    <div className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-3 sm:gap-6">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{formatTime(departure)}</p>
          <p className="text-xs text-gray-500">{fromLabel}</p>
        </div>

        <div className="flex flex-1 flex-col items-center px-1">
          <span className="text-[10px] text-gray-400">ETA {CROSSING_DURATION_HOURS} Hr</span>
          <div className="flex w-full items-center">
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-teal-700" />
            <span className="mx-1 flex-1 border-t border-dashed border-gray-300" />
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-teal-700" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-gray-800">{formatTime(arrival)}</p>
          <p className="text-xs text-gray-500">{toLabel}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
        <p className="text-lg font-bold text-teal-700">&#8369;{schedule.baseFare}</p>
        <button
          onClick={onBook}
          className="rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          Book
        </button>
      </div>
    </div>
  )
}
