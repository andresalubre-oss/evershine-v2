// Save as: frontend/src/components/SearchFormFields.jsx

// The actual search controls (trip type, From/To + swap, dates, Search
// button). Used on the landing page and reused (with an onCancel) on the
// search results page for modifying a search in place.
export default function SearchFormFields({
  tripType, setTripType, direction, ports, swapDirection,
  date, setDate, returnDate, setReturnDate,
  onSearch, onCancel, loading, error,
}) {
  return (
    <>
      {/* Round Trip / One-way toggle */}
      <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setTripType('roundtrip')}
          className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
            tripType === 'roundtrip' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Round Trip
        </button>
        <button
          type="button"
          onClick={() => setTripType('oneway')}
          className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
            tripType === 'oneway' ? 'bg-teal-700 text-white' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          One-way
        </button>
      </div>

      {/* From / To — read-only, since routes are fixed. Swap button flips direction. */}
      <div className="mt-5 flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3">
          <span className="block text-xs text-gray-500">From</span>
          <span className="block truncate font-medium text-gray-800">{ports.from}</span>
        </div>

        <button
          type="button"
          onClick={swapDirection}
          title="Swap origin and destination"
          aria-label="Swap origin and destination"
          className="group flex flex-shrink-0 flex-col items-center gap-1"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-teal-700 text-teal-700 transition-colors duration-300 group-hover:bg-teal-700 group-hover:text-white sm:h-11 sm:w-11">
            <svg
              className={`h-4 w-4 transition-transform duration-300 sm:h-5 sm:w-5 ${
                direction === 'LIMASAWA_TO_PB' ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Swap</span>
        </button>

        <div className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3">
          <span className="block text-xs text-gray-500">To</span>
          <span className="block truncate font-medium text-gray-800">{ports.to}</span>
        </div>
      </div>

      {/* Dates + Search button */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          {tripType === 'roundtrip' && (
            <label className="mb-1 block text-xs text-gray-500">Departure Date</label>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        {tripType === 'roundtrip' && (
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-500">Return Date</label>
            <input
              type="date"
              value={returnDate}
              min={date}
              onChange={(e) => setReturnDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        )}

        <button
          onClick={onSearch}
          disabled={loading}
          className="rounded-md bg-teal-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50 sm:self-end"
        >
          {loading ? 'Searching...' : 'Search Trips'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 sm:self-end"
          >
            Cancel
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </>
  )
}
