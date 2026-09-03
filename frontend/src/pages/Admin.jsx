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

// No built-in top margin — tab content wraps its Cards in a `space-y-6`
// container instead, so spacing stays consistent next to the sidebar.
function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      {title && <h2 className="text-lg font-semibold text-gray-800">{title}</h2>}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </div>
  )
}

// A plain <div> when there's nothing to click through to, or a real <button>
// (with a highlighted ring when `active`) when `onClick` is provided so a tab
// like Analytics can use these as toggles for a details panel.
function StatCard({ label, value, icon: Icon, accent = 'teal', onClick, active = false }) {
  const styles = {
    teal: 'bg-teal-50 text-teal-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  const content = (
    <>
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${styles[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase leading-tight tracking-wide text-gray-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-gray-800">{value}</p>
      </div>
    </>
  )
  if (!onClick) {
    return <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{content}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-lg border bg-white p-4 text-left shadow-sm transition-colors ${
        active ? 'border-teal-600 ring-1 ring-teal-600' : 'border-gray-200 hover:border-teal-300'
      }`}
    >
      {content}
    </button>
  )
}

// Bordered/table-wrapper so headers and rows look consistent everywhere.
function DataTable({ headers, children }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function fullName(p) {
  return [p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean).join(' ')
}

function fullAddress(p) {
  return [p.barangay, p.cityMunicipality, p.province, p.zipCode, p.country].filter(Boolean).join(', ')
}

// "2026-08" -> "Aug 2026"
function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// Lightweight bar chart, no charting library — plain divs sized with
// percentage height, consistent with the rest of the app's zero-dependency
// approach (see the inline SVG icons below).
function RevenueBarChart({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">No data for this range.</p>
  }
  const max = Math.max(...data.map((d) => Number(d.revenue)), 1)
  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-2 pt-6">
      {data.map((d) => {
        const heightPct = Math.max((Number(d.revenue) / max) * 100, 3)
        return (
          <div key={d.month} className="flex min-w-[56px] flex-1 flex-col items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-medium text-gray-600">{formatPeso(d.revenue)}</span>
            <div className="flex h-40 w-full items-end rounded-t-md bg-gray-50">
              <div
                className="w-full rounded-t-md bg-teal-600"
                style={{ height: `${heightPct}%` }}
                title={`${formatMonthLabel(d.month)}: ${formatPeso(d.revenue)} across ${d.count} booking${d.count === 1 ? '' : 's'}`}
              />
            </div>
            <span className="whitespace-nowrap text-[11px] text-gray-500">{formatMonthLabel(d.month)}</span>
          </div>
        )
      })}
    </div>
  )
}

// Receipts/discount IDs are served through an authenticated route, so a plain
// <img src> won't work — fetch as a blob and render that instead. When
// `expandable` is set, clicking the thumbnail toggles a larger inline view
// (no lightbox library needed) so admins can actually read small print on IDs.
function AdminImage({ path, alt, className, expandable = false }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let objectUrl
    api.getAdminFileUrl(path)
      .then((u) => { objectUrl = u; setUrl(u) })
      .catch(() => setError(true))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path])

  if (error) return <p className="text-sm text-red-600">Could not load image.</p>
  if (!url) return <p className="text-sm text-gray-500">Loading image...</p>
  return (
    <img
      src={url}
      alt={alt}
      onClick={expandable ? () => setExpanded((v) => !v) : undefined}
      title={expandable ? (expanded ? 'Click to shrink' : 'Click to enlarge') : undefined}
      // Inline style beats the max-h/max-w Tailwind classes in `className`
      // (arbitrary-value utilities don't reliably win via class order alone).
      style={expanded ? { maxWidth: '100%', maxHeight: 'none' } : undefined}
      className={`${className} ${expandable ? (expanded ? 'cursor-zoom-out' : 'cursor-zoom-in') : ''}`}
    />
  )
}

// --- Icons (simple, dependency-free inline SVGs) -----------------------

function IconGrid(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconPin(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="9" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21c-4-4.5-7-8-7-11a7 7 0 1114 0c0 3-3 6.5-7 11z" />
    </svg>
  )
}
function IconTag(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7l9 9-7 7-9-9V4z" />
      <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconList(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function IconClipboard(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path strokeLinecap="round" d="M9 3h6v3H9zM8 11h8M8 15h8" />
    </svg>
  )
}
function IconChartBar(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="12" width="3.5" height="8" rx="1" fill="currentColor" />
      <rect x="10.25" y="7" width="3.5" height="13" rx="1" fill="currentColor" />
      <rect x="16.5" y="3" width="3.5" height="17" rx="1" fill="currentColor" />
    </svg>
  )
}
function IconShield(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
}
function IconRefund(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h11a5 5 0 010 10H9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l-4 4 4 4" />
    </svg>
  )
}
function IconUsers(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4.5a3.5 3.5 0 010 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 14.6c2.7.4 4.7 2.3 5.5 5.4" />
    </svg>
  )
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: IconGrid },
  { id: 'ferries', label: 'Ferries & Schedules', icon: IconPin },
  { id: 'customers', label: 'Customers', icon: IconUsers },
  { id: 'discounts', label: 'Profile Verification', icon: IconTag },
  { id: 'bookings', label: 'All Bookings', icon: IconList },
  { id: 'refunds', label: 'Refund Requests', icon: IconRefund },
  { id: 'manifest', label: 'Manifest', icon: IconClipboard },
  { id: 'analytics', label: 'Analytics', icon: IconChartBar },
  { id: 'security', label: 'Security', icon: IconShield },
]

export default function Admin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

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

  const [pendingDiscounts, setPendingDiscounts] = useState([])
  const [discountsMessage, setDiscountsMessage] = useState('')
  const [expiryDates, setExpiryDates] = useState({}) // customerId -> 'YYYY-MM-DD'

  const [customers, setCustomers] = useState([])
  const [customersMessage, setCustomersMessage] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [allBookings, setAllBookings] = useState([])
  const [bookingsMessage, setBookingsMessage] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')

  const [refundRequests, setRefundRequests] = useState([])
  const [refundsMessage, setRefundsMessage] = useState('')
  const [processingRefundId, setProcessingRefundId] = useState(null)
  // Which guided panel (if any) is open per booking: 'approve' | 'reject' | undefined
  const [openRefundAction, setOpenRefundAction] = useState({})
  const [refundConfirmChecked, setRefundConfirmChecked] = useState({})

  const [manifestScheduleId, setManifestScheduleId] = useState('')
  const [manifestPassengers, setManifestPassengers] = useState([])
  const [manifestMessage, setManifestMessage] = useState('')

  const [analytics, setAnalytics] = useState([])
  const [analyticsMessage, setAnalyticsMessage] = useState('')
  const [analyticsFrom, setAnalyticsFrom] = useState('') // 'YYYY-MM', '' = no lower bound
  const [analyticsTo, setAnalyticsTo] = useState('')     // 'YYYY-MM', '' = no upper bound
  const [expandedStat, setExpandedStat] = useState(null) // which Analytics StatCard's detail panel is open

  // --- Security tab (2FA) ---
  const [adminInfo, setAdminInfo] = useState(null) // { id, email, name, twoFactorEnabled }
  const [securityMessage, setSecurityMessage] = useState('')
  const [securityError, setSecurityError] = useState(false)
  const [setupData, setSetupData] = useState(null) // { qrCode, secret } while mid-setup, before enabling
  const [enableCode, setEnableCode] = useState('')
  const [enabling, setEnabling] = useState(false)
  const [startingSetup, setStartingSetup] = useState(false)
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disabling, setDisabling] = useState(false)

  // Loaded eagerly on mount (not lazily per-tab) since the Overview stat
  // cards need all of these regardless of which tab is active.
  useEffect(() => {
    loadFerries()
    loadSchedules()
    loadPendingDiscounts()
    loadRefundRequests()
    loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadCustomers() {
    setCustomersMessage('')
    try {
      const data = await api.getAllCustomers()
      setCustomers(data)
    } catch (err) {
      setCustomersMessage(err.message)
    }
  }

  async function loadPendingDiscounts() {
    setDiscountsMessage('')
    try {
      const data = await api.getPendingDiscounts()
      setPendingDiscounts(data)
    } catch (err) {
      setDiscountsMessage(err.message)
    }
  }

  async function verifyDiscount(id) {
    const expiresAt = expiryDates[id]
    if (!expiresAt) {
      setDiscountsMessage('Pick an expiry date for this ID before verifying.')
      return
    }
    setDiscountsMessage('')
    try {
      await api.verifyDiscount(id, expiresAt)
      loadPendingDiscounts()
    } catch (err) {
      setDiscountsMessage(err.message)
    }
  }

  async function rejectDiscount(id) {
    await api.rejectDiscount(id)
    loadPendingDiscounts()
  }

  async function loadRefundRequests() {
    setRefundsMessage('')
    try {
      const data = await api.getRefundRequests()
      setRefundRequests(data)
    } catch (err) {
      setRefundsMessage(err.message)
    }
  }

  // Refunds are always sent manually outside the app (bank transfer, GCash,
  // etc.) — this just records that an admin reviewed the request and
  // confirms the money has actually gone out.
  function closeRefundPanel(id) {
    setOpenRefundAction((prev) => ({ ...prev, [id]: undefined }))
    setRefundConfirmChecked((prev) => ({ ...prev, [id]: false }))
  }

  async function markRefunded(id) {
    setRefundsMessage('')
    setProcessingRefundId(id)
    try {
      await api.markRefunded(id)
      closeRefundPanel(id)
      await loadRefundRequests()
    } catch (err) {
      setRefundsMessage(err.message)
    } finally {
      setProcessingRefundId(null)
    }
  }

  async function rejectRefund(id) {
    setRefundsMessage('')
    setProcessingRefundId(id)
    try {
      await api.rejectRefundRequest(id)
      closeRefundPanel(id)
      await loadRefundRequests()
    } catch (err) {
      setRefundsMessage(err.message)
    } finally {
      setProcessingRefundId(null)
    }
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

  // All Bookings can be a long list, so it still loads lazily the first
  // time that tab is opened rather than eagerly on mount.
  useEffect(() => {
    if (activeTab === 'bookings' && allBookings.length === 0) loadAllBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'customers' && customers.length === 0) loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'security' && !adminInfo) loadAdminInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function loadAdminInfo() {
    try {
      const data = await api.getAdminMe()
      setAdminInfo(data)
    } catch (err) {
      setSecurityMessage(err.message)
      setSecurityError(true)
    }
  }

  async function startTwoFactorSetup() {
    setSecurityMessage('')
    setSecurityError(false)
    setStartingSetup(true)
    try {
      const data = await api.setup2fa()
      setSetupData(data)
      setEnableCode('')
    } catch (err) {
      setSecurityMessage(err.message)
      setSecurityError(true)
    } finally {
      setStartingSetup(false)
    }
  }

  async function confirmTwoFactorEnable() {
    setSecurityMessage('')
    setSecurityError(false)
    setEnabling(true)
    try {
      await api.enable2fa(enableCode)
      setSetupData(null)
      setEnableCode('')
      setSecurityMessage('Two-factor authentication is now enabled.')
      await loadAdminInfo()
    } catch (err) {
      setSecurityMessage(err.message)
      setSecurityError(true)
    } finally {
      setEnabling(false)
    }
  }

  async function confirmTwoFactorDisable() {
    setSecurityMessage('')
    setSecurityError(false)
    setDisabling(true)
    try {
      await api.disable2fa(disablePassword)
      setShowDisableForm(false)
      setDisablePassword('')
      setSecurityMessage('Two-factor authentication is now disabled.')
      await loadAdminInfo()
    } catch (err) {
      setSecurityMessage(err.message)
      setSecurityError(true)
    } finally {
      setDisabling(false)
    }
  }

  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonth = analytics.find((m) => m.month === currentMonthKey)
  const thisMonthRevenue = thisMonth ? Number(thisMonth.revenue) : 0
  const thisMonthCount = thisMonth ? thisMonth.count : 0

  // `analytics` comes back sorted oldest-to-newest from the API — filtering
  // client-side (rather than re-querying) keeps the range picker instant
  // since this dataset is just one row per month.
  const filteredAnalytics = analytics.filter(
    (m) => (!analyticsFrom || m.month >= analyticsFrom) && (!analyticsTo || m.month <= analyticsTo)
  )
  const analyticsWithChange = filteredAnalytics.map((m, i) => {
    const prev = filteredAnalytics[i - 1]
    const change = prev && Number(prev.revenue) > 0 ? ((Number(m.revenue) - Number(prev.revenue)) / Number(prev.revenue)) * 100 : null
    return { ...m, change }
  })
  const totalRevenue = filteredAnalytics.reduce((sum, m) => sum + Number(m.revenue), 0)
  const totalBookingsInRange = filteredAnalytics.reduce((sum, m) => sum + m.count, 0)
  const avgMonthlyRevenue = filteredAnalytics.length > 0 ? totalRevenue / filteredAnalytics.length : 0
  const bestMonth = filteredAnalytics.length > 0
    ? filteredAnalytics.reduce((best, m) => (Number(m.revenue) > Number(best.revenue) ? m : best))
    : null
  const analyticsRangeLabel = analyticsFrom && analyticsTo
    ? `${formatMonthLabel(analyticsFrom)} – ${formatMonthLabel(analyticsTo)}`
    : analyticsFrom
    ? `${formatMonthLabel(analyticsFrom)} onward`
    : analyticsTo
    ? `through ${formatMonthLabel(analyticsTo)}`
    : 'all recorded months'

  return (
    <div>
      <div className="flex items-center justify-end print:hidden">
        <button onClick={logout} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
          Log Out
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row print:mt-0 print:block">
        {/* Sidebar — horizontal scroll on mobile, vertical column on larger screens.
            Hidden entirely when printing, so only the active tab's content shows. */}
        <aside className="sm:w-60 sm:flex-shrink-0 print:hidden">
          <nav className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:sticky sm:top-24 sm:flex-col sm:overflow-visible">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors sm:w-full ${
                    active ? 'bg-teal-700 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Pending Verification Requests" value={pendingDiscounts.length} icon={IconTag} accent="purple" />
                <StatCard label="Refund Requests" value={refundRequests.length} icon={IconRefund} accent="blue" />
                <StatCard label="This Month's Revenue" value={`₱${thisMonthRevenue.toLocaleString()}`} icon={IconChartBar} accent="teal" />
                <StatCard label="This Month's Bookings" value={thisMonthCount} icon={IconList} accent="blue" />
              </div>

              {(pendingDiscounts.length > 0 || refundRequests.length > 0) && (
                <Card title="Needs Your Attention">
                  <div className="space-y-2">
                    {pendingDiscounts.length > 0 && (
                      <button
                        onClick={() => setActiveTab('discounts')}
                        className="flex w-full items-center justify-between rounded-md border border-purple-200 bg-purple-50 px-4 py-3 text-left text-sm hover:bg-purple-100"
                      >
                        <span className="font-medium text-purple-800">
                          {pendingDiscounts.length} verification request{pendingDiscounts.length === 1 ? '' : 's'} awaiting review
                        </span>
                        <span className="text-purple-700">Review &rarr;</span>
                      </button>
                    )}
                    {refundRequests.length > 0 && (
                      <button
                        onClick={() => setActiveTab('refunds')}
                        className="flex w-full items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm hover:bg-blue-100"
                      >
                        <span className="font-medium text-blue-800">
                          {refundRequests.length} refund request{refundRequests.length === 1 ? '' : 's'} awaiting review
                        </span>
                        <span className="text-blue-700">Review &rarr;</span>
                      </button>
                    )}
                  </div>
                </Card>
              )}

              <Card title="Fleet at a Glance">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-800">{ferries.length}</span> ferr{ferries.length === 1 ? 'y' : 'ies'} registered,{' '}
                  <span className="font-semibold text-gray-800">{schedules.length}</span> scheduled sailing{schedules.length === 1 ? '' : 's'}.
                </p>
              </Card>
            </div>
          )}

          {activeTab === 'ferries' && (
            <div className="space-y-6">
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
                <DataTable headers={['Date/Time', 'Direction', 'Fare', 'Ferry']}>
                  {schedules.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(s.departureDatetime).toLocaleString()}</td>
                      <td className="px-3 py-2">{s.direction}</td>
                      <td className="px-3 py-2">&#8369;{s.baseFare}</td>
                      <td className="px-3 py-2">{s.ferry ? s.ferry.name : ''}</td>
                    </tr>
                  ))}
                </DataTable>
              </Card>
            </div>
          )}

          {activeTab === 'discounts' && (
            <div className="space-y-6">
              <Card title="Profile Verification Requests">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button onClick={loadPendingDiscounts} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                  {pendingDiscounts.length > 0 && (
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                      {pendingDiscounts.length} pending
                    </span>
                  )}
                </div>
                {discountsMessage && <p className="mt-2 text-sm text-red-600">{discountsMessage}</p>}

                {pendingDiscounts.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No pending verification requests right now.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {pendingDiscounts.map((c) => {
                      const initials = c.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || '?'
                      const discountBadge = {
                        student: 'bg-blue-100 text-blue-700',
                        senior: 'bg-purple-100 text-purple-700',
                        pwd: 'bg-amber-100 text-amber-700',
                      }[c.discountType] || 'bg-gray-100 text-gray-700'
                      const chosenDate = expiryDates[c.id] || ''

                      function setQuickExpiry(months) {
                        const d = new Date()
                        d.setMonth(d.getMonth() + months)
                        setExpiryDates((prev) => ({ ...prev, [c.id]: d.toISOString().slice(0, 10) }))
                      }

                      return (
                        <div key={c.id} className="rounded-lg border border-gray-200 p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{c.name}</p>
                                <p className="text-sm text-gray-500">
                                  {c.email}{c.contactNumber ? ` · ${c.contactNumber}` : ''}
                                </p>
                              </div>
                            </div>
                            <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize ${discountBadge}`}>
                              {c.discountType} discount
                            </span>
                          </div>

                          {c.createdAt && (
                            <p className="mt-2 text-xs text-gray-400">
                              Submitted {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}

                          <div className="mt-4 grid grid-cols-1 gap-5">
                            <div className="flex flex-wrap gap-4">
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Live Selfie</p>
                                {c.selfiePath ? (
                                  <AdminImage
                                    path={c.selfiePath}
                                    alt="Live selfie"
                                    expandable
                                    className="mt-1 max-h-48 max-w-[160px] rounded-md border border-gray-200 object-contain"
                                  />
                                ) : (
                                  <p className="mt-1 text-sm text-gray-500">No selfie captured.</p>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">ID (Front)</p>
                                {c.discountIdPath ? (
                                  <AdminImage
                                    path={c.discountIdPath}
                                    alt="ID front"
                                    expandable
                                    className="mt-1 max-h-48 max-w-[220px] rounded-md border border-gray-200 object-contain"
                                  />
                                ) : (
                                  <p className="mt-1 text-sm text-gray-500">No ID uploaded.</p>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">ID (Back)</p>
                                {c.discountIdBackPath ? (
                                  <AdminImage
                                    path={c.discountIdBackPath}
                                    alt="ID back"
                                    expandable
                                    className="mt-1 max-h-48 max-w-[220px] rounded-md border border-gray-200 object-contain"
                                  />
                                ) : (
                                  <p className="mt-1 text-sm text-gray-500">No back-of-ID uploaded.</p>
                                )}
                              </div>
                            </div>

                            <div className="min-w-0">
                              <label className="block text-sm font-medium text-gray-700">
                                Valid until <span className="font-normal text-gray-400">(check the expiry printed on their ID)</span>
                              </label>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <input
                                  type="date"
                                  value={chosenDate}
                                  onChange={(e) => setExpiryDates((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                                />
                                <button type="button" onClick={() => setQuickExpiry(6)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                                  +6 mo
                                </button>
                                <button type="button" onClick={() => setQuickExpiry(12)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                                  +1 yr
                                </button>
                                <button type="button" onClick={() => setQuickExpiry(24)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                                  +2 yrs
                                </button>
                              </div>

                              <div className="mt-4 flex gap-2">
                                <button
                                  onClick={() => verifyDiscount(c.id)}
                                  disabled={!chosenDate}
                                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Reject ${c.name}'s ${c.discountType} discount request?`)) rejectDiscount(c.id)
                                  }}
                                  className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                  Reject
                                </button>
                              </div>
                              {!chosenDate && (
                                <p className="mt-2 text-xs text-gray-400">Pick an expiry date (or use a shortcut above) to enable Verify.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-6">
              <Card title="Customer Directory">
                <p className="text-sm text-gray-600">
                  Every registered account — verified or not — so you can look up contact details (e.g. to send an
                  invoice) without digging through bookings.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={loadCustomers} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by name, email, or contact number..."
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {customers.length} registered
                  </span>
                </div>
                {customersMessage && <p className="mt-2 text-sm text-red-600">{customersMessage}</p>}

                {(() => {
                  const query = customerSearch.trim().toLowerCase()
                  const filtered = !query
                    ? customers
                    : customers.filter((c) => {
                        const name = fullName(c).toLowerCase()
                        return (
                          name.includes(query) ||
                          c.email.toLowerCase().includes(query) ||
                          (c.contactNumber || '').toLowerCase().includes(query)
                        )
                      })

                  const discountBadgeStyles = {
                    verified: 'bg-green-100 text-green-800',
                    pending: 'bg-amber-100 text-amber-800',
                    rejected: 'bg-red-100 text-red-800',
                    expired: 'bg-red-100 text-red-800',
                    none: 'bg-gray-100 text-gray-600',
                  }

                  function effectiveStatus(c) {
                    if (c.discountStatus === 'verified' && c.discountVerifiedUntil && new Date(c.discountVerifiedUntil) < new Date()) {
                      return 'expired'
                    }
                    return c.discountStatus
                  }

                  return filtered.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">
                      {customers.length === 0 ? 'No registered customers yet.' : 'No customers match that search.'}
                    </p>
                  ) : (
                    <DataTable headers={['Name', 'Contact', 'Address', 'Profile Status', 'Registered']}>
                      {filtered.map((c) => {
                        const status = effectiveStatus(c)
                        const address = [c.barangay, c.cityMunicipality, c.province, c.zipCode, c.region]
                          .filter(Boolean)
                          .join(', ')
                        return (
                          <tr key={c.id} className="border-t border-gray-100 align-top hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-800">{fullName(c)}</td>
                            <td className="px-3 py-2">
                              <p>{c.email}</p>
                              <p className="text-gray-500">{c.contactNumber || '—'}</p>
                            </td>
                            <td className="px-3 py-2 max-w-[220px] text-gray-600">{address || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${discountBadgeStyles[status] || 'bg-gray-100 text-gray-600'}`}>
                                {status}
                              </span>
                              {status === 'verified' && c.discountType !== 'none' && (
                                <p className="mt-0.5 whitespace-nowrap text-xs capitalize text-gray-500">{c.discountType} discount</p>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                              {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                          </tr>
                        )
                      })}
                    </DataTable>
                  )
                })()}
              </Card>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <Card title="All Bookings">
                <p className="text-sm text-gray-600">
                  Includes guest checkouts — bookings made without an account still show the contact email and
                  number entered at checkout, so you can reach anyone who's booked, verified account or not.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={loadAllBookings} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search by reference, email, contact number, or passenger..."
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {allBookings.length} total
                  </span>
                </div>
                {bookingsMessage && <p className="mt-2 text-sm text-red-600">{bookingsMessage}</p>}

                {(() => {
                  const query = bookingSearch.trim().toLowerCase()
                  const filtered = !query
                    ? allBookings
                    : allBookings.filter((b) => {
                        const passengerNames = b.passengers.map((p) => fullName(p)).join(' ').toLowerCase()
                        return (
                          (b.referenceCode || '').toLowerCase().includes(query) ||
                          (b.contactEmail || '').toLowerCase().includes(query) ||
                          (b.contactNumber || '').toLowerCase().includes(query) ||
                          passengerNames.includes(query)
                        )
                      })

                  return filtered.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">
                      {allBookings.length === 0 ? 'No bookings yet.' : 'No bookings match that search.'}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {filtered.map((b) => (
                        <div key={b.id} className="rounded-lg border border-gray-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-bold tracking-wide text-gray-800">{b.referenceCode || '-'}</p>
                              {b.customerId ? (
                                <span className="whitespace-nowrap rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
                                  Registered
                                </span>
                              ) : (
                                <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                  Guest
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={b.status} />
                              <span className="font-semibold text-gray-800">&#8369;{b.totalFare}</span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-2">
                            <p>
                              <span className="text-gray-400">Contact:</span> {b.contactEmail}
                              {b.contactNumber ? ` · ${b.contactNumber}` : ''}
                            </p>
                            <p>
                              <span className="text-gray-400">Trip:</span>{' '}
                              {b.schedule ? new Date(b.schedule.departureDatetime).toLocaleString() : '—'}
                            </p>
                            <p className="sm:col-span-2">
                              <span className="text-gray-400">Passengers:</span>{' '}
                              {b.passengers.map((p) => fullName(p)).join(', ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </Card>
            </div>
          )}

          {activeTab === 'refunds' && (
            <div className="space-y-6">
              <Card title="Refund Requests">
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <button onClick={loadRefundRequests} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                  {refundRequests.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {refundRequests.length} pending
                    </span>
                  )}
                </div>
                {refundsMessage && <p className="mt-2 text-sm text-red-600">{refundsMessage}</p>}

                {refundRequests.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No refund requests awaiting review right now.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {refundRequests.map((b) => {
                      const isProcessing = processingRefundId === b.id
                      return (
                        <div key={b.id} className="rounded-lg border border-gray-200 p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-sm font-bold tracking-wide text-gray-800">{b.referenceCode}</p>
                              <p className="mt-0.5 text-sm text-gray-500">
                                {b.contactEmail}{b.contactNumber ? ` · ${b.contactNumber}` : ''}
                              </p>
                            </div>
                            <span className="whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              ₱{Number(b.totalFare).toLocaleString()} to refund
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-600 sm:grid-cols-2">
                            <p>
                              <span className="text-gray-400">Departure:</span>{' '}
                              {b.schedule ? new Date(b.schedule.departureDatetime).toLocaleString() : '—'}
                            </p>
                            <p>
                              <span className="text-gray-400">Booked:</span>{' '}
                              {new Date(b.createdAt).toLocaleString()}
                            </p>
                            <p className="sm:col-span-2">
                              <span className="text-gray-400">Passengers:</span>{' '}
                              {b.passengers.map((p) => fullName(p)).join(', ')}
                            </p>
                          </div>

                          <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Customer's Reason</p>
                            <p className="mt-1 text-sm text-gray-700">{b.cancellationReason || '—'}</p>
                          </div>

                          {(() => {
                            const openAction = openRefundAction[b.id]
                            const checked = Boolean(refundConfirmChecked[b.id])
                            const passengerName = b.passengers[0] ? fullName(b.passengers[0]) : 'there'
                            const fareStr = Number(b.totalFare).toLocaleString()

                            const approveMailto =
                              `mailto:${b.contactEmail}?subject=${encodeURIComponent(`Confirming your refund details — ${b.referenceCode}`)}` +
                              `&body=${encodeURIComponent(
                                `Hi ${passengerName},\n\nWe're processing your refund of ₱${fareStr} for booking ${b.referenceCode}. Since your payment was made through a QR code, we don't automatically see which GCash, Maya, or bank account it came from — could you reply with the account name, number, and provider you'd like the refund sent to?\n\nThanks,\nEvershine Booking`
                              )}`

                            const rejectMailto =
                              `mailto:${b.contactEmail}?subject=${encodeURIComponent(`Update on your cancellation request — ${b.referenceCode}`)}` +
                              `&body=${encodeURIComponent(
                                `Hi ${passengerName},\n\nWe've reviewed your cancellation request for booking ${b.referenceCode} and are unable to approve the refund at this time.\n\n[Add your reason here]\n\nIf you have questions, feel free to reply to this email.\n\nThanks,\nEvershine Booking`
                              )}`

                            return (
                              <div className="mt-4">
                                {!openAction && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setOpenRefundAction((prev) => ({ ...prev, [b.id]: 'approve' }))}
                                      disabled={isProcessing}
                                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                    >
                                      Approve &amp; Refund
                                    </button>
                                    <button
                                      onClick={() => setOpenRefundAction((prev) => ({ ...prev, [b.id]: 'reject' }))}
                                      disabled={isProcessing}
                                      className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}

                                {openAction === 'approve' && (
                                  <div className="rounded-md border border-green-200 bg-green-50 p-4">
                                    <p className="text-sm font-semibold text-green-800">Approve &amp; send refund</p>
                                    <ol className="mt-2 space-y-2 text-sm text-gray-700">
                                      <li>
                                        <span className="font-medium">1. Confirm where to send it.</span> QR Ph payments
                                        don't record which e-wallet or bank the customer paid with, so ask them directly
                                        before sending anything.
                                        <div className="mt-1 flex flex-wrap gap-2">
                                          <a
                                            href={approveMailto}
                                            className="inline-block rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                                          >
                                            Email: {b.contactEmail}
                                          </a>
                                          {b.contactNumber && (
                                            <span className="inline-flex items-center rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
                                              Or text: {b.contactNumber}
                                            </span>
                                          )}
                                        </div>
                                      </li>
                                      <li>
                                        <span className="font-medium">2. Send ₱{fareStr}</span> to the account they
                                        confirm, using your own GCash/Maya/bank transfer app.
                                      </li>
                                    </ol>
                                    <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) =>
                                          setRefundConfirmChecked((prev) => ({ ...prev, [b.id]: e.target.checked }))
                                        }
                                        className="mt-0.5"
                                      />
                                      I've sent the ₱{fareStr} refund to the customer's confirmed account.
                                    </label>
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        onClick={() => markRefunded(b.id)}
                                        disabled={!checked || isProcessing}
                                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                      >
                                        {isProcessing ? 'Working...' : 'Confirm & Mark as Refunded'}
                                      </button>
                                      <button
                                        onClick={() => closeRefundPanel(b.id)}
                                        disabled={isProcessing}
                                        className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {openAction === 'reject' && (
                                  <div className="rounded-md border border-red-200 bg-red-50 p-4">
                                    <p className="text-sm font-semibold text-red-800">Reject this request</p>
                                    <p className="mt-2 text-sm text-gray-700">
                                      Rejecting won't notify the customer automatically. Let them know yourself so
                                      they're not left wondering.
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <a
                                        href={rejectMailto}
                                        className="inline-block rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                      >
                                        Email {b.contactEmail}
                                      </a>
                                      {b.contactNumber && (
                                        <span className="inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
                                          Also text: {b.contactNumber}
                                        </span>
                                      )}
                                    </div>
                                    <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) =>
                                          setRefundConfirmChecked((prev) => ({ ...prev, [b.id]: e.target.checked }))
                                        }
                                        className="mt-0.5"
                                      />
                                      I've emailed and texted the customer about this decision.
                                    </label>
                                    <div className="mt-3 flex gap-2">
                                      <button
                                        onClick={() => rejectRefund(b.id)}
                                        disabled={!checked || isProcessing}
                                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                      >
                                        {isProcessing ? 'Working...' : 'Confirm Rejection'}
                                      </button>
                                      <button
                                        onClick={() => closeRefundPanel(b.id)}
                                        disabled={isProcessing}
                                        className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'manifest' && (
            <div className="space-y-6">
              {/* print:border-0/shadow-none/p-0 strips the card chrome so only the
                  title + table print — the controls below are print:hidden entirely. */}
              <Card title="Passenger Manifest" className="print:border-0 print:p-0 print:shadow-none">
                <div className="print:hidden">
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
                </div>

                {/* Print-only line so the printed sheet still says which sailing this is,
                    without any of the on-screen controls. */}
                {manifestScheduleId && (
                  <p className="hidden text-sm text-gray-600 print:block">
                    {(() => {
                      const s = schedules.find((sc) => sc.id === manifestScheduleId)
                      return s ? `${new Date(s.departureDatetime).toLocaleString()} - ${s.direction}` : ''
                    })()}
                  </p>
                )}

                <DataTable headers={['Name', 'Sex', 'Nationality', 'Address', 'Email', 'Contact']}>
                  {manifestPassengers.map((p, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{fullName(p)}</td>
                      <td className="px-3 py-2">{p.sex || ''}</td>
                      <td className="px-3 py-2">{p.nationality || ''}</td>
                      <td className="px-3 py-2">{fullAddress(p)}</td>
                      <td className="px-3 py-2">{p.email || ''}</td>
                      <td className="px-3 py-2">{p.contactNumber || ''}</td>
                    </tr>
                  ))}
                </DataTable>
              </Card>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Revenue"
                  value={formatPeso(totalRevenue)}
                  icon={IconChartBar}
                  accent="teal"
                  active={expandedStat === 'revenue'}
                  onClick={() => setExpandedStat(expandedStat === 'revenue' ? null : 'revenue')}
                />
                <StatCard
                  label="Total Bookings"
                  value={totalBookingsInRange}
                  icon={IconList}
                  accent="blue"
                  active={expandedStat === 'bookings'}
                  onClick={() => setExpandedStat(expandedStat === 'bookings' ? null : 'bookings')}
                />
                <StatCard
                  label="Avg. Monthly Revenue"
                  value={formatPeso(avgMonthlyRevenue)}
                  icon={IconTag}
                  accent="purple"
                  active={expandedStat === 'avg'}
                  onClick={() => setExpandedStat(expandedStat === 'avg' ? null : 'avg')}
                />
                <StatCard
                  label="Best Month"
                  value={bestMonth ? formatMonthLabel(bestMonth.month) : '—'}
                  icon={IconClipboard}
                  accent="amber"
                  active={expandedStat === 'best'}
                  onClick={() => setExpandedStat(expandedStat === 'best' ? null : 'best')}
                />
              </div>

              {expandedStat && (
                <Card className="border-teal-200 bg-teal-50/50">
                  {expandedStat === 'revenue' && (
                    <p className="text-sm text-gray-700">
                      <b>{formatPeso(totalRevenue)}</b> in confirmed booking fares across <b>{analyticsRangeLabel}</b>
                      {filteredAnalytics.length > 0 && (
                        <> — spread over {filteredAnalytics.length} month{filteredAnalytics.length === 1 ? '' : 's'} with sales.</>
                      )}
                    </p>
                  )}
                  {expandedStat === 'bookings' && (
                    <p className="text-sm text-gray-700">
                      <b>{totalBookingsInRange}</b> confirmed booking{totalBookingsInRange === 1 ? '' : 's'} in {analyticsRangeLabel}
                      {filteredAnalytics.length > 0 && (
                        <> — about {(totalBookingsInRange / filteredAnalytics.length).toFixed(1)} per month on average.</>
                      )}
                    </p>
                  )}
                  {expandedStat === 'avg' && (
                    <p className="text-sm text-gray-700">
                      {formatPeso(totalRevenue)} total &divide; {filteredAnalytics.length} month{filteredAnalytics.length === 1 ? '' : 's'} with sales ={' '}
                      <b>{formatPeso(avgMonthlyRevenue)}</b> average per month, for {analyticsRangeLabel}.
                    </p>
                  )}
                  {expandedStat === 'best' && (
                    bestMonth ? (
                      <p className="text-sm text-gray-700">
                        <b>{formatMonthLabel(bestMonth.month)}</b> was the strongest month in this range: {formatPeso(bestMonth.revenue)} from{' '}
                        {bestMonth.count} booking{bestMonth.count === 1 ? '' : 's'}
                        {avgMonthlyRevenue > 0 && (
                          <>
                            {' '}— {Math.abs(((Number(bestMonth.revenue) - avgMonthlyRevenue) / avgMonthlyRevenue) * 100).toFixed(0)}%{' '}
                            {Number(bestMonth.revenue) >= avgMonthlyRevenue ? 'above' : 'below'} the range average.
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700">No confirmed bookings in this range yet.</p>
                    )
                  )}
                </Card>
              )}

              <Card title="Monthly Sales">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-gray-500">From</label>
                    <input
                      type="month"
                      value={analyticsFrom}
                      onChange={(e) => setAnalyticsFrom(e.target.value)}
                      className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">To</label>
                    <input
                      type="month"
                      value={analyticsTo}
                      onChange={(e) => setAnalyticsTo(e.target.value)}
                      className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  {(analyticsFrom || analyticsTo) && (
                    <button
                      onClick={() => { setAnalyticsFrom(''); setAnalyticsTo('') }}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Clear range
                    </button>
                  )}
                  <button
                    onClick={loadAnalytics}
                    className="ml-auto rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                  >
                    Refresh
                  </button>
                </div>
                {analyticsMessage && <p className="mt-2 text-sm text-red-600">{analyticsMessage}</p>}

                <div className="mt-5">
                  <RevenueBarChart data={filteredAnalytics} />
                </div>

                <DataTable headers={['Month', 'Revenue', 'Bookings', 'Change']}>
                  {[...analyticsWithChange].reverse().map((m) => (
                    <tr key={m.month} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{formatMonthLabel(m.month)}</td>
                      <td className="px-3 py-2">{formatPeso(m.revenue)}</td>
                      <td className="px-3 py-2">{m.count}</td>
                      <td className="px-3 py-2">
                        {m.change === null ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span className={m.change >= 0 ? 'text-green-700' : 'text-red-700'}>
                            {m.change >= 0 ? '▲' : '▼'} {Math.abs(m.change).toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </DataTable>
                {filteredAnalytics.length === 0 && (
                  <p className="mt-3 text-sm text-gray-500">No sales data for this range yet.</p>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card title="Two-Factor Authentication">
                {!adminInfo ? (
                  <p className="text-sm text-gray-500">Loading...</p>
                ) : (
                  <>
                    <div
                      className={`rounded-md border p-4 text-sm ${
                        adminInfo.twoFactorEnabled
                          ? 'border-teal-200 bg-teal-50 text-teal-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {adminInfo.twoFactorEnabled
                        ? `Enabled for ${adminInfo.email}. You'll be asked for a code from your authenticator app every time you log in.`
                        : `Not enabled for ${adminInfo.email}. Anyone with your password can log in — turning this on requires a code from an app like Google Authenticator too.`}
                    </div>

                    {securityMessage && (
                      <p className={`mt-3 text-sm ${securityError ? 'text-red-600' : 'text-teal-700'}`}>{securityMessage}</p>
                    )}

                    {/* --- Not enabled, no setup in progress: show the "turn it on" button --- */}
                    {!adminInfo.twoFactorEnabled && !setupData && (
                      <button
                        onClick={startTwoFactorSetup}
                        disabled={startingSetup}
                        className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        {startingSetup ? 'Starting setup...' : 'Set Up Two-Factor Authentication'}
                      </button>
                    )}

                    {/* --- Setup in progress: show QR code + confirmation code field --- */}
                    {!adminInfo.twoFactorEnabled && setupData && (
                      <div className="mt-4 space-y-4 rounded-md border border-gray-200 p-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            1. Scan this QR code with Google Authenticator, Authy, or a similar app.
                          </p>
                          <img src={setupData.qrCode} alt="2FA setup QR code" className="mt-3 h-44 w-44 rounded-md border border-gray-200" />
                          <p className="mt-2 text-xs text-gray-500">
                            Can't scan it? Enter this code manually: <code className="rounded bg-gray-100 px-1.5 py-0.5">{setupData.secret}</code>
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            2. Enter the 6-digit code the app shows now
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={enableCode}
                            onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            className="mt-1.5 w-40 rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-[0.3em]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={confirmTwoFactorEnable}
                            disabled={enabling || enableCode.length !== 6}
                            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                          >
                            {enabling ? 'Confirming...' : 'Confirm & Enable'}
                          </button>
                          <button
                            onClick={() => { setSetupData(null); setEnableCode('') }}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* --- Already enabled: offer to disable (requires password) --- */}
                    {adminInfo.twoFactorEnabled && !showDisableForm && (
                      <button
                        onClick={() => setShowDisableForm(true)}
                        className="mt-4 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Disable Two-Factor Authentication
                      </button>
                    )}

                    {adminInfo.twoFactorEnabled && showDisableForm && (
                      <div className="mt-4 space-y-3 rounded-md border border-red-200 bg-red-50 p-4">
                        <label className="block text-sm font-medium text-gray-700">
                          Confirm your password to disable 2FA
                        </label>
                        <input
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={confirmTwoFactorDisable}
                            disabled={disabling || !disablePassword}
                            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {disabling ? 'Disabling...' : 'Confirm Disable'}
                          </button>
                          <button
                            onClick={() => { setShowDisableForm(false); setDisablePassword('') }}
                            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
