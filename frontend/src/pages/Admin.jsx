import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const statusColors = {
  confirmed: 'bg-green-100 text-green-800',
  pending_payment: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-gray-100 text-gray-700',
  payment_declined: 'bg-red-100 text-red-800',
  refund_requested: 'bg-blue-100 text-blue-800',
  refunded: 'bg-blue-100 text-blue-800',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function Card({ title, children }) {
  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function fullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ')
}

function fullAddress(p) {
  return [p.barangay, p.cityMunicipality, p.province, p.zipCode, p.country].filter(Boolean).join(', ')
}

// Receipts/discount IDs are served through an authenticated route, so a plain
// <img src> won't work — fetch as a blob and render that instead.
function AdminImage({ path, alt, className }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let objectUrl
    api.getAdminFileUrl(path)
      .then((u) => { objectUrl = u; setUrl(u) })
      .catch(() => setError(true))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path])

  if (error) return <p className="text-sm text-red-600">Could not load image.</p>
  if (!url) return <p className="text-sm text-gray-500">Loading image...</p>
  return <img src={url} alt={alt} className={className} />
}

const TABS = [
  { id: 'ferries', label: 'Ferries & Schedules' },
  { id: 'pending', label: 'Pending Payments' },
  { id: 'bookings', label: 'All Bookings' },
  { id: 'manifest', label: 'Manifest' },
  { id: 'analytics', label: 'Analytics' },
]

export default function Admin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('ferries')

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      navigate('/login')
    }
  }, [navigate])

  function logout() {
    localStorage.removeItem('adminToken')
    navigate('/login')
  }

  const [ferries, setFerries] = useState([])
  const [ferryName, setFerryName] = useState('')
  const [ferryCapacity, setFerryCapacity] = useState('')
  const [ferryMessage, setFerryMessage] = useState('')
  const [ferryError, setFerryError] = useState(false)

  const [scheduleFerryId, setScheduleFerryId] = useState('')
  const [scheduleDirection, setScheduleDirection] = useState('PB_TO_LIMASAWA')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleFare, setScheduleFare] = useState('')
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [scheduleError, setScheduleError] = useState(false)
  const [schedules, setSchedules] = useState([])
  const [schedulesMessage, setSchedulesMessage] = useState('')

  const [pendingBookings, setPendingBookings] = useState([])
  const [pendingMessage, setPendingMessage] = useState('')

  const [allBookings, setAllBookings] = useState([])
  const [bookingsMessage, setBookingsMessage] = useState('')

  const [manifestScheduleId, setManifestScheduleId] = useState('')
  const [manifestPassengers, setManifestPassengers] = useState([])
  const [manifestMessage, setManifestMessage] = useState('')

  const [analytics, setAnalytics] = useState([])
  const [analyticsMessage, setAnalyticsMessage] = useState('')

  useEffect(() => {
    loadFerries()
    loadSchedules()
  }, [])

  async function loadFerries() {
    try {
      const data = await api.getFerries()
      setFerries(data)
      if (!scheduleFerryId && data.length > 0) setScheduleFerryId(data[0].id)
    } catch (err) {
      setFerryMessage(err.message)
      setFerryError(true)
    }
  }

  async function addFerry() {
    setFerryMessage('')
    setFerryError(false)
    try {
      const data = await api.addFerry({ name: ferryName, seat_capacity: parseInt(ferryCapacity) })
      setFerryMessage(`Ferry "${data.ferry.name}" added.`)
      setFerryName('')
      setFerryCapacity('')
      loadFerries()
    } catch (err) {
      setFerryMessage(err.message)
      setFerryError(true)
    }
  }

  async function addSchedule() {
    setScheduleMessage('')
    setScheduleError(false)
    if (!scheduleFerryId || !scheduleDate || !scheduleTime || !scheduleFare) {
      setScheduleMessage('Please fill in all fields.')
      setScheduleError(true)
      return
    }
    const departure_datetime = `${scheduleDate} ${scheduleTime}:00`
    try {
      await api.addSchedule({
        ferry_id: scheduleFerryId,
        direction: scheduleDirection,
        departure_datetime,
        base_fare: parseFloat(scheduleFare),
      })
      setScheduleMessage(`Schedule added for ${departure_datetime}.`)
      loadSchedules()
    } catch (err) {
      setScheduleMessage(err.message)
      setScheduleError(true)
    }
  }

  async function loadSchedules() {
    setSchedulesMessage('')
    try {
      const data = await api.getAdminSchedules()
      setSchedules(data)
    } catch (err) {
      setSchedulesMessage(err.message)
    }
  }

  async function loadPendingPayments() {
    setPendingMessage('')
    try {
      const data = await api.getPendingBookings()
      setPendingBookings(data)
    } catch (err) {
      setPendingMessage(err.message)
    }
  }

  async function approve(id) {
    await api.approveBooking(id)
    loadPendingPayments()
  }

  async function decline(id) {
    await api.declineBooking(id)
    loadPendingPayments()
  }

  async function loadAllBookings() {
    setBookingsMessage('')
    try {
      const data = await api.getAllBookings()
      setAllBookings(data)
    } catch (err) {
      setBookingsMessage(err.message)
    }
  }

  async function loadManifest() {
    setManifestMessage('')
    if (!manifestScheduleId) return
    try {
      const data = await api.getManifest(manifestScheduleId)
      setManifestPassengers(data)
    } catch (err) {
      setManifestMessage(err.message)
    }
  }

  async function loadAnalytics() {
    setAnalyticsMessage('')
    try {
      const data = await api.getMonthlySales()
      setAnalytics(data)
    } catch (err) {
      setAnalyticsMessage(err.message)
    }
  }

  useEffect(() => {
    if (activeTab === 'pending' && pendingBookings.length === 0) loadPendingPayments()
    if (activeTab === 'bookings' && allBookings.length === 0) loadAllBookings()
    if (activeTab === 'analytics' && analytics.length === 0) loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        <button onClick={logout} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Log Out
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-teal-700 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'ferries' && (
        <>
          <Card title="Add Ferry">
            <label className="block text-sm text-gray-600">Ferry Name</label>
            <input type="text" placeholder="e.g. MV Evershine 3" value={ferryName} onChange={(e) => setFerryName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            <label className="mt-3 block text-sm text-gray-600">Seat Capacity</label>
            <input type="number" placeholder="e.g. 80" value={ferryCapacity} onChange={(e) => setFerryCapacity(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            <button onClick={addFerry} className="mt-3 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              Add Ferry
            </button>
            {ferryMessage && <p className={`mt-2 text-sm ${ferryError ? 'text-red-600' : 'text-teal-700'}`}>{ferryMessage}</p>}
          </Card>

          <Card title="Add Schedule">
            <label className="block text-sm text-gray-600">Ferry</label>
            <select value={scheduleFerryId} onChange={(e) => setScheduleFerryId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              {ferries.map((f) => (
                <option key={f.id} value={f.id}>{f.name} (cap. {f.seatCapacity})</option>
              ))}
            </select>
            <label className="mt-3 block text-sm text-gray-600">Direction</label>
            <select value={scheduleDirection} onChange={(e) => setScheduleDirection(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="PB_TO_LIMASAWA">Padre Burgos &rarr; Limasawa</option>
              <option value="LIMASAWA_TO_PB">Limasawa &rarr; Padre Burgos</option>
            </select>
            <label className="mt-3 block text-sm text-gray-600">Date</label>
            <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            <label className="mt-3 block text-sm text-gray-600">Time</label>
            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            <label className="mt-3 block text-sm text-gray-600">Fare (&#8369;)</label>
            <input type="number" placeholder="e.g. 150" value={scheduleFare} onChange={(e) => setScheduleFare(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
            <button onClick={addSchedule} className="mt-3 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              Add Schedule
            </button>
            {scheduleMessage && <p className={`mt-2 text-sm ${scheduleError ? 'text-red-600' : 'text-teal-700'}`}>{scheduleMessage}</p>}
          </Card>

          <Card title="All Schedules">
            <button onClick={loadSchedules} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              Refresh List
            </button>
            {schedulesMessage && <p className="mt-2 text-sm text-red-600">{schedulesMessage}</p>}
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-1">Date/Time</th><th className="py-1">Direction</th><th className="py-1">Fare</th><th className="py-1">Ferry</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-1">{new Date(s.departureDatetime).toLocaleString()}</td>
                    <td className="py-1">{s.direction}</td>
                    <td className="py-1">&#8369;{s.baseFare}</td>
                    <td className="py-1">{s.ferry ? s.ferry.name : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {activeTab === 'pending' && (
        <Card title="Pending Payments">
          <button onClick={loadPendingPayments} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Refresh
          </button>
          {pendingMessage && <p className="mt-2 text-sm text-red-600">{pendingMessage}</p>}
          {pendingBookings.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No pending payments right now.</p>
          ) : (
            <div className="mt-3 space-y-4">
              {pendingBookings.map((b) => (
                <div key={b.id} className="rounded-md border border-gray-200 p-4">
                  <p className="text-sm"><b>Reference:</b> {b.referenceCode} | <b>Total:</b> &#8369;{b.totalFare}</p>
                  <p className="mt-1 text-sm"><b>Passengers:</b> {b.passengers.map((p) => fullName(p)).join(', ')}</p>

                  <p className="mt-2 text-sm font-medium text-gray-700">Payment Receipt</p>
                  {b.receiptImagePath && (
                    <AdminImage path={b.receiptImagePath} alt="Receipt" className="mt-1 max-w-xs rounded-md border border-gray-200" />
                  )}

                  {b.passengers.filter((p) => p.discountType !== 'none').map((p) => (
                    <div key={p.id} className="mt-2">
                      <p className="text-sm font-medium text-gray-700">
                        Discount ID &mdash; {fullName(p)} ({p.discountType})
                      </p>
                      {p.discountIdPath ? (
                        <AdminImage path={p.discountIdPath} alt="Discount ID" className="mt-1 max-w-xs rounded-md border border-gray-200" />
                      ) : (
                        <p className="text-sm text-gray-500">No ID uploaded.</p>
                      )}
                    </div>
                  ))}

                  <div className="mt-3 flex gap-2">
                    <button onClick={() => approve(b.id)} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">Approve</button>
                    <button onClick={() => decline(b.id)} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'bookings' && (
        <Card title="All Bookings">
          <button onClick={loadAllBookings} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Refresh
          </button>
          {bookingsMessage && <p className="mt-2 text-sm text-red-600">{bookingsMessage}</p>}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-1">Reference</th><th className="py-1">Trip</th><th className="py-1">Status</th><th className="py-1">Total Fare</th><th className="py-1">Passengers</th>
              </tr>
            </thead>
            <tbody>
              {allBookings.map((b) => (
                <tr key={b.id} className="border-b border-gray-100">
                  <td className="py-1">{b.referenceCode || '-'}</td>
                  <td className="py-1">{b.schedule ? new Date(b.schedule.departureDatetime).toLocaleString() : ''}</td>
                  <td className="py-1"><StatusBadge status={b.status} /></td>
                  <td className="py-1">&#8369;{b.totalFare}</td>
                  <td className="py-1">{b.passengers.map((p) => fullName(p)).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'manifest' && (
        <Card title="Passenger Manifest">
          <label className="block text-sm text-gray-600">Schedule</label>
          <select value={manifestScheduleId} onChange={(e) => setManifestScheduleId(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
            <option value="">Select a schedule</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>{new Date(s.departureDatetime).toLocaleString()} - {s.direction}</option>
            ))}
          </select>
          <div className="mt-3 flex gap-2">
            <button onClick={loadManifest} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              Generate Manifest
            </button>
            <button onClick={() => window.print()} className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
              Print
            </button>
          </div>
          {manifestMessage && <p className="mt-2 text-sm text-red-600">{manifestMessage}</p>}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-1">Name</th><th className="py-1">Sex</th><th className="py-1">Nationality</th><th className="py-1">Address</th><th className="py-1">Email</th><th className="py-1">Contact</th>
              </tr>
            </thead>
            <tbody>
              {manifestPassengers.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1">{fullName(p)}</td>
                  <td className="py-1">{p.sex || ''}</td>
                  <td className="py-1">{p.nationality || ''}</td>
                  <td className="py-1">{fullAddress(p)}</td>
                  <td className="py-1">{p.email || ''}</td>
                  <td className="py-1">{p.contactNumber || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'analytics' && (
        <Card title="Monthly Sales">
          <button onClick={loadAnalytics} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Refresh
          </button>
          {analyticsMessage && <p className="mt-2 text-sm text-red-600">{analyticsMessage}</p>}
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-1">Month</th><th className="py-1">Revenue</th><th className="py-1">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((m, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1">{m.month}</td><td className="py-1">&#8369;{m.revenue}</td><td className="py-1">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
