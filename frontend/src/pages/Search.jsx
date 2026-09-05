import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import BookingSteps from '../components/BookingSteps.jsx'

const today = new Date().toISOString().split('T')[0]

// Approximate Padre Burgos <-> Limasawa crossing time. The schedule table
// only stores a departure time, not an arrival time, so this is used to
// show an estimated arrival — adjust here if the real crossing time differs.
const CROSSING_DURATION_HOURS = 1

const PORT_NAMES = {
  PB_TO_LIMASAWA: { from: 'Padre Burgos', to: 'Limasawa' },
  LIMASAWA_TO_PB: { from: 'Limasawa', to: 'Padre Burgos' },
}

function oppositeDirection(direction) {
  return direction === 'PB_TO_LIMASAWA' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// One trip result — departure/arrival times with a duration line between
// them, port names, price, and a Book button. Same card used for both the
// outbound and return lists.
function TripCard({ schedule, fromLabel, toLabel, onBook }) {
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

function SearchFormFields({
  tripType, setTripType, direction, ports, swapDirection,
  date, setDate, returnDate, setReturnDate,
  onSearch, onCancel, loading, error,
}) {
  return (
    <>
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


function DateNavHeader({ dateStr, onPrev, onNext }) {
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

export default function Search() {
  const navigate = useNavigate()
  const [direction, setDirection] = useState('PB_TO_LIMASAWA')
  const [tripType, setTripType] = useState('oneway') 
  const [date, setDate] = useState(today)
  const [returnDate, setReturnDate] = useState(today)
  const [outboundResults, setOutboundResults] = useState(null)
  const [returnResults, setReturnResults] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ports = PORT_NAMES[direction]

  function swapDirection() {
    setDirection((prev) => oppositeDirection(prev))
    setOutboundResults(null)
    setReturnResults(null)
  }

  async function runSearch() {
    if (!date) {
      setError('Please choose a departure date.')
      setOutboundResults(null)
      setReturnResults(null)
      return false
    }
    if (tripType === 'roundtrip') {
      if (!returnDate) {
        setError('Please choose a return date.')
        return false
      }
      if (returnDate < date) {
        setError('Return date must be on or after the departure date.')
        return false
      }
    }

    setError('')
    setLoading(true)
    try {
      const outbound = await api.getSchedules(direction, date)
      setOutboundResults(outbound)

      if (tripType === 'roundtrip') {
        const ret = await api.getSchedules(oppositeDirection(direction), returnDate)
        setReturnResults(ret)
      } else {
        setReturnResults(null)
      }
      return true
    } catch (err) {
      setError(err.message)
      setOutboundResults(null)
      setReturnResults(null)
      return false
    } finally {
      setLoading(false)
    }
  }

   function handleSearch() {
    if (!date) { setError('Please choose a departure date.'); return }
    if (tripType === 'roundtrip') {
      if (!returnDate) { setError('Please choose a return date.'); return }
      if (returnDate < date) { setError('Return date must be on or after the departure date.'); return }
    }
    const params = new URLSearchParams({ direction, tripType, date })
    if (tripType === 'roundtrip') params.set('returnDate', returnDate)
    navigate(`/search-results?${params.toString()}`)
  }

  async function changeDepartureDate(deltaDays) {
    const newDate = shiftDate(date, deltaDays)
    setDate(newDate)
    setLoading(true)
    try {
      const outbound = await api.getSchedules(direction, newDate)
      setOutboundResults(outbound)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function changeReturnDate(deltaDays) {
    const newDate = shiftDate(returnDate, deltaDays)
    setReturnDate(newDate)
    setLoading(true)
    try {
      const ret = await api.getSchedules(oppositeDirection(direction), newDate)
      setReturnResults(ret)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function bookTrip(schedule, tripDirection) {
    const params = new URLSearchParams({
      schedule_id: schedule.id,
      fare: schedule.baseFare,
      datetime: schedule.departureDatetime,
      direction: tripDirection,
    })
    navigate(`/booking?${params.toString()}`)
  }

  return (
    <div>
    
      <div className="relative left-1/2 -mt-28 -ml-[50vw] w-screen bg-[url('/hero.jpg')] bg-cover [background-position:center_30%] bg-no-repeat">
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <h1 className="text-2xl font-bold text-white drop-shadow sm:text-3xl lg:text-4xl">
            Travel to <span className="italic">Limasawa Island</span> with Ease!
          </h1>
          <p className="mt-2 text-sm text-white/90 drop-shadow sm:text-base">
            Search available trips and book your seat in minutes.
          </p>

          {/* Search form — always visible, never hides or collapses. */}
          <div className="mt-6 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-xl sm:max-w-3xl sm:p-6">
            <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">Where's your next adventure?</h2>
            <p className="mt-1 text-sm text-gray-600">Let's make your next trip one to remember.</p>

            <div className="mt-4">
              <SearchFormFields
                tripType={tripType}
                setTripType={setTripType}
                direction={direction}
                ports={ports}
                swapDirection={swapDirection}
                date={date}
                setDate={setDate}
                returnDate={returnDate}
                setReturnDate={setReturnDate}
                onSearch={handleSearch}
                loading={loading}
                error={error}
              />
            </div>
          </div>
        </div>
      </div>

<div className="relative left-1/2 -ml-[50vw] w-screen overflow-hidden bg-[url('/section2-hero-bg.png')] bg-cover bg-top bg-no-repeat">
  <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 sm:grid-cols-2 sm:py-24">
    <div className="text-center sm:text-left">
      <img src="/evershine-logo.png" alt="Evershine" className="mx-auto h-16 w-28 sm:mx-0 sm:h-25 sm:w-44" />
      <h2 className="mt-2 text-2xl font-bold text-gray-800 sm:text-4xl">Where We Sail</h2>
      <p className="mt-4 text-sm leading-relaxed text-gray-700 sm:text-base">
        We connect <span className="font-semibold">Padre Burgos</span> to{' '}
        <span className="font-semibold">Limasawa Island</span> — a short, scenic crossing
        across Southern Leyte's coastal waters.
      </p>
      <p className="mt-4 text-sm leading-relaxed text-gray-700 sm:text-base">
        Book your seat and set sail on one of Southern Leyte's most historic routes.
      </p>
    </div>
    <div
      className="h-102 w-full bg-[url('/section2-hero.png')] bg-cover bg-[position:75%_55%] bg-no-repeat sm:h-[500px]"
      role="img"
      aria-label="Map of the Padre Burgos to Limasawa ferry route"
    />
  </div>
</div>


      {(outboundResults || returnResults) && (
        <div className="mx-auto max-w-5xl px-4">
          <BookingSteps currentStep="schedule" />

          {outboundResults && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-800">
                Departure: {ports.from} &rarr; {ports.to}
              </h3>
              <div className="mt-2">
                <DateNavHeader dateStr={date} onPrev={() => changeDepartureDate(-1)} onNext={() => changeDepartureDate(1)} />
              </div>
              {outboundResults.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No trips found for that date.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {outboundResults.map((s) => (
                    <TripCard
                      key={s.id}
                      schedule={s}
                      fromLabel={ports.from}
                      toLabel={ports.to}
                      onBook={() => bookTrip(s, direction)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tripType === 'roundtrip' && returnResults && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="font-semibold text-gray-800">
                Return: {ports.to} &rarr; {ports.from}
              </h3>
              <div className="mt-2">
                <DateNavHeader dateStr={returnDate} onPrev={() => changeReturnDate(-1)} onNext={() => changeReturnDate(1)} />
              </div>
              {returnResults.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No return trips found for that date.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {returnResults.map((s) => (
                    <TripCard
                      key={s.id}
                      schedule={s}
                      fromLabel={ports.to}
                      toLabel={ports.from}
                      onBook={() => bookTrip(s, oppositeDirection(direction))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tripType === 'roundtrip' && (outboundResults || returnResults) && (
            <p className="mt-4 pb-6 text-xs text-gray-500">
              Book your departure and return trips one at a time — each gets its own reference code and payment.
            </p>
          )}
        </div>
      )}


      <p className="mt-10 text-center text-sm">
        <a href="/manage-booking" className="text-teal-700 hover:underline">
          Already booked? Manage your booking here
        </a>
      </p>
    </div>
    
  )
}
  