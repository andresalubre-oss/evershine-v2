import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'

const directionLabel = {
  PB_TO_LIMASAWA: 'Padre Burgos → Limasawa',
  LIMASAWA_TO_PB: 'Limasawa → Padre Burgos',
}

function fullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ')
}

function fullAddress(p) {
  return [p.barangay, p.cityMunicipality, p.province, p.zipCode, p.country].filter(Boolean).join(', ')
}

// Standalone, print-friendly manifest — deliberately outside <Layout/> (no
// sidebar, top nav, or footer) so what prints is just the document itself.
// Opened in a new tab from Admin.jsx's Manifest tab via
// `/admin/manifest-print?scheduleId=...`; fetches its own data since it
// doesn't share React state with the dashboard tab that opened it.
export default function ManifestPrint() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get('scheduleId') || ''

  const [schedule, setSchedule] = useState(null)
  const [passengers, setPassengers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      navigate('/login')
      return
    }
    if (!scheduleId) {
      setError('No schedule was specified.')
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const [schedules, manifest] = await Promise.all([api.getAdminSchedules(), api.getManifest(scheduleId)])
        if (cancelled) return
        setSchedule(schedules.find((s) => s.id === scheduleId) || null)
        setPassengers(manifest)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load the manifest.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [scheduleId, navigate])

  if (loading) {
    return <div className="p-8 text-sm text-gray-500">Loading manifest…</div>
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={() => window.close()}
          className="mt-3 rounded-md border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    )
  }

  const departureLabel = schedule
    ? new Date(schedule.departureDatetime).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'
  const directionText = schedule ? directionLabel[schedule.direction] || schedule.direction : '—'
  const seatsLeft = schedule?.ferry ? Math.max(schedule.ferry.seatCapacity - passengers.length, 0) : null
  const generatedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div className="mx-auto max-w-5xl p-8 text-gray-900">
      {/* Screen-only toolbar — never shows up in the printed/PDF output. */}
      <div className="mb-6 flex items-center gap-2 print:hidden">
        <button onClick={() => window.print()} className="rounded-md bg-teal-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
          Print
        </button>
        <button onClick={() => window.close()} className="rounded-md border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Close
        </button>
      </div>

      {/* Document header */}
      <div className="flex items-start justify-between gap-4 border-b-2 border-gray-900 pb-4">
        <div className="flex items-center gap-2.5">
          <img src="/evershine-logo.png" alt="Evershine" className="h-11 w-auto" />
          <div>
            <p className="text-base font-bold leading-tight">Evershine Booking</p>
            <p className="text-xs leading-tight text-gray-500">Padre Burgos &harr; Limasawa</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold leading-tight">Passenger Manifest</p>
          <p className="text-xs text-gray-500">Generated {generatedAt}</p>
        </div>
      </div>

      {/* Trip details */}
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-gray-300 p-4 sm:grid-cols-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Route</p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{directionText}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Departure</p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{departureLabel}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Vessel</p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{schedule?.ferry ? schedule.ferry.name : '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Seat Capacity</p>
          <p className="mt-0.5 text-sm font-medium text-gray-900">{schedule?.ferry ? schedule.ferry.seatCapacity : '—'}</p>
        </div>
      </div>

      {/* Passenger count summary */}
      <div className="mt-3 grid grid-cols-2 divide-x divide-gray-300 rounded-md border border-gray-300">
        <div className="px-3 py-2.5 text-center">
          <p className="text-xl font-bold leading-none text-gray-900">{passengers.length}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Passenger{passengers.length === 1 ? '' : 's'}</p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="text-xl font-bold leading-none text-gray-900">{seatsLeft === null ? '—' : seatsLeft}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Seats Left</p>
        </div>
      </div>

      {passengers.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No passengers booked for this sailing.</p>
      ) : (
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900 bg-gray-50">
              <th className="py-2 pl-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">No.</th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Name</th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Sex</th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Nationality</th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Address</th>
              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Email</th>
              <th className="py-2 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Contact</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((p, i) => (
              <tr key={i} className="border-b border-gray-200 [&:nth-child(even)]:bg-gray-50">
                <td className="py-2 pl-2 pr-3 text-gray-500">{i + 1}</td>
                <td className="py-2 pr-3 font-medium text-gray-900">{fullName(p)}</td>
                <td className="py-2 pr-3">{p.sex || '—'}</td>
                <td className="py-2 pr-3">{p.nationality || '—'}</td>
                <td className="py-2 pr-3">{fullAddress(p) || '—'}</td>
                <td className="py-2 pr-3">{p.email || '—'}</td>
                <td className="py-2 pr-2">{p.contactNumber || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Sign-off — printed manifests are typically countersigned once boarding is confirmed. */}
      <div className="mt-10 grid grid-cols-2 gap-8">
        <div>
          <div className="h-10 border-b border-gray-400" />
          <p className="mt-1 text-xs text-gray-500">Verified by (Crew/Purser)</p>
        </div>
        <div>
          <div className="h-10 border-b border-gray-400" />
          <p className="mt-1 text-xs text-gray-500">Signature &amp; Date</p>
        </div>
      </div>

      <p className="mt-8 border-t border-gray-200 pt-3 text-xs text-gray-400">
        Evershine Booking &middot; Passenger Manifest &middot; Generated {generatedAt}
      </p>
    </div>
  )
}
