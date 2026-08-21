import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const today = new Date().toISOString().split('T')[0]

const PORT_NAMES = {
  PB_TO_LIMASAWA: { from: 'Padre Burgos', to: 'Limasawa' },
  LIMASAWA_TO_PB: { from: 'Limasawa', to: 'Padre Burgos' },
}

export default function Search() {
  const navigate = useNavigate()
  const [direction, setDirection] = useState('PB_TO_LIMASAWA')
  const [date, setDate] = useState(today)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ports = PORT_NAMES[direction]

  function swapDirection() {
    setDirection(direction === 'PB_TO_LIMASAWA' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA')
    setResults(null)
  }

  async function handleSearch() {
    if (!date) {
      setError('Please choose a date.')
      setResults(null)
      return
    }
    setError('')
    setLoading(true)
    try {
      const schedules = await api.getSchedules(direction, date)
      setResults(schedules)
    } catch (err) {
      setError(err.message)
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  function bookTrip(schedule) {
    const params = new URLSearchParams({
      schedule_id: schedule.id,
      fare: schedule.baseFare,
      datetime: schedule.departureDatetime,
      direction,
    })
    navigate(`/booking?${params.toString()}`)
  }

  return (
    <div>
      {/* SECTION 1 — full-bleed hero photo with overlay + floating search card */}
      <div className="relative left-1/2 -mt-28 -ml-[50vw] w-screen bg-[url('/hero.jpg')] bg-cover [background-position:center_30%] bg-no-repeat">
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <h1 className="text-2xl font-bold text-white drop-shadow sm:text-3xl lg:text-4xl">
            Travel to <span className="italic">Limasawa Island</span> with Ease!
          </h1>
          <p className="mt-2 text-sm text-white/90 drop-shadow sm:text-base">
            Search available trips and book your seat in minutes.
          </p>

          <div className="mt-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:max-w-3xl sm:p-6">
            <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">Where's your next adventure?</h2>
            <p className="mt-1 text-sm text-gray-600">Let's make your next trip one to remember.</p>

            {/* From / To — read-only, since routes are fixed. Swap button flips direction. */}
            <div className="mt-5 flex items-center gap-2 sm:gap-3">
              <div className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3">
                <span className="block text-xs text-gray-500">From</span>
                <span className="block truncate font-medium text-gray-800">{ports.from}</span>
              </div>

              <button
                type="button"
                onClick={swapDirection}
                aria-label="Swap origin and destination"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 sm:h-10 sm:w-10"
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </button>

              <div className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 sm:px-4 sm:py-3">
                <span className="block text-xs text-gray-500">To</span>
                <span className="block truncate font-medium text-gray-800">{ports.to}</span>
              </div>
            </div>

            {/* Departure date + Search button */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="rounded-md bg-teal-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search Trips'}
              </button>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            {results && results.length === 0 && (
              <p className="mt-4 text-sm text-gray-500">No trips found for that date.</p>
            )}

            {results && results.length > 0 && (
              <div className="mt-6 space-y-3">
                {results.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                  >
                    <div>
                      <p className="font-semibold text-gray-800">
                        {new Date(s.departureDatetime).toLocaleString()}
                      </p>
                      <p className="text-teal-700 font-bold">&#8369;{s.baseFare}</p>
                    </div>
                    <button
                      onClick={() => bookTrip(s)}
                      className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                    >
                      Book
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Utility link below the hero */}
      <p className="mt-10 text-center text-sm">
        <a href="/manage-booking" className="text-teal-700 hover:underline">
          Already booked? Manage your booking here
        </a>
      </p>
    </div>
  )
}
