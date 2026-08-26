// Save as: frontend/src/pages/SearchResults.jsx
//
// Dedicated results page — the landing page ("/") only ever shows the hero
// + search form and never renders results itself. Clicking "Search Trips"
// there navigates here with the search criteria in the URL, so this page
// is bookmarkable/shareable and the landing page always stays clean.

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import BookingSteps from '../components/BookingSteps.jsx'
import SearchFormFields from '../components/SearchFormFields.jsx'
import TripCard from '../components/TripCard.jsx'
import DateNavHeader from '../components/DateNavHeader.jsx'
import { PORT_NAMES, oppositeDirection, shiftDate } from '../lib/portUtils.js'

const today = new Date().toISOString().split('T')[0]

export default function SearchResults() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [direction, setDirection] = useState(
    searchParams.get('direction') === 'LIMASAWA_TO_PB' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'
  )
  const [tripType, setTripType] = useState(searchParams.get('tripType') === 'roundtrip' ? 'roundtrip' : 'oneway')
  const [date, setDate] = useState(searchParams.get('date') || today)
  const [returnDate, setReturnDate] = useState(searchParams.get('returnDate') || searchParams.get('date') || today)

  const [outboundResults, setOutboundResults] = useState(null)
  const [returnResults, setReturnResults] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const ports = PORT_NAMES[direction]

  function swapDirection() {
    setDirection((prev) => oppositeDirection(prev))
  }

  async function runSearch(searchDirection, searchTripType, searchDate, searchReturnDate) {
    setError('')
    setLoading(true)
    try {
      const outbound = await api.getSchedules(searchDirection, searchDate)
      setOutboundResults(outbound)

      if (searchTripType === 'roundtrip') {
        const ret = await api.getSchedules(oppositeDirection(searchDirection), searchReturnDate)
        setReturnResults(ret)
      } else {
        setReturnResults(null)
      }
    } catch (err) {
      setError(err.message)
      setOutboundResults(null)
      setReturnResults(null)
    } finally {
      setLoading(false)
    }
  }

  // Run the search whenever this page is opened or landed on via a link —
  // reads straight from the URL so the page works from a bookmark too.
  useEffect(() => {
    runSearch(direction, tripType, date, returnDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSearch() {
    if (!date) {
      setError('Please choose a departure date.')
      return
    }
    if (tripType === 'roundtrip') {
      if (!returnDate) {
        setError('Please choose a return date.')
        return
      }
      if (returnDate < date) {
        setError('Return date must be on or after the departure date.')
        return
      }
    }
    await runSearch(direction, tripType, date, returnDate)
    setEditing(false)
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

  // Each leg books independently (its own reference code and payment) —
  // tripDirection is passed explicitly since the return leg's direction is
  // the opposite of whatever `direction` currently holds.
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
      <BookingSteps currentStep="schedule" />

      {editing ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800">Modify Search</h2>
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
              onCancel={() => setEditing(false)}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Departure</p>
              <p className="font-bold text-gray-800">{ports.from} &rarr; {ports.to}</p>
            </div>
            {tripType === 'roundtrip' && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Return</p>
                <p className="font-bold text-gray-800">{ports.to} &rarr; {ports.from}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
          >
            Modify Search
          </button>
        </div>
      )}

      {!editing && error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!editing && loading && !outboundResults && (
        <p className="mt-6 text-sm text-gray-500">Searching...</p>
      )}

      {!editing && outboundResults && (
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

      {!editing && tripType === 'roundtrip' && returnResults && (
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

      {!editing && tripType === 'roundtrip' && (outboundResults || returnResults) && (
        <p className="mt-4 pb-6 text-xs text-gray-500">
          Book your departure and return trips one at a time — each gets its own reference code and payment.
        </p>
      )}
    </div>
  )
}
