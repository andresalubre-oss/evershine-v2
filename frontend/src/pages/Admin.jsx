import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

const statusColors = {
  confirmed: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300',
  pending_payment: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300',
  cancelled: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300',
  payment_declined: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300',
  refund_requested: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300',
  refunded: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[status] || 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

// No built-in top margin — tab content wraps its Cards in a `space-y-5`
// container instead, so spacing stays consistent next to the sidebar.
function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm ${className}`}>
      {title && <h2 className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h2>}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </div>
  )
}

// Compact, data-dense KPI tile: a teal accent bar instead of a large icon
// circle, a small icon for quick scanning, and an optional `hint` line for
// context (trend vs. last month, a secondary count, etc). The bar uses
// `self-stretch` (not a fixed height) so it always matches the card's own
// content height exactly, even when a label wraps to two lines — otherwise
// bars end up visibly different lengths/positions from card to card. Every
// card uses the same teal accent rather than a different color per card, to
// keep the row visually consistent. A plain <div> when there's nothing to
// click through to, or a real <button> (solid teal fill when `active` — same
// treatment as the Customer Directory's filter tiles, no ring/glow; a plain
// background tint on hover otherwise, no colored border) when `onClick` is
// provided so a tab like Analytics can use these as toggles for a details
// panel.
function StatCard({ label, value, icon: Icon, onClick, active = false, hint }) {
  const content = (
    <div className="flex w-full gap-3">
      <div className={`w-1 flex-shrink-0 self-stretch rounded-full ${active ? 'bg-white/50' : 'bg-teal-600'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[11px] font-semibold uppercase leading-tight tracking-wide ${active ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>{label}</p>
          {Icon && <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-teal-50' : 'text-teal-600'}`} />}
        </div>
        <p className={`mt-1 text-2xl font-bold leading-none ${active ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{value}</p>
        {hint && <p className={`mt-1.5 truncate text-xs ${active ? 'text-teal-50/80' : 'text-gray-500 dark:text-slate-500'}`}>{hint}</p>}
      </div>
    </div>
  )
  if (!onClick) {
    return <div className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm">{content}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3.5 text-left shadow-sm transition-colors ${
        active
          ? 'border-teal-700 bg-teal-700'
          : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800/60'
      }`}
    >
      {content}
    </button>
  )
}

// Bordered/table-wrapper so headers and rows look consistent everywhere.
// Sticky header + zebra striping keep long, dense tables scannable.
function DataTable({ headers, children }) {
  return (
    <div className="mt-3 max-h-[520px] overflow-auto rounded-md border border-gray-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-gray-50/60 dark:[&>tr:nth-child(even)]:bg-slate-800/40">{children}</tbody>
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

// A verified discount lapses once discountVerifiedUntil passes — mirrors the
// backend's isDiscountExpired so the Overview KPI and the Customers tab
// agree on what "verified" means right now.
function isCustomerDiscountVerified(c) {
  return c.discountStatus === 'verified' && (!c.discountVerifiedUntil || new Date(c.discountVerifiedUntil) >= new Date())
}

// "2026-08" -> "Aug 2026"
function formatMonthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// "5m ago" / "3h ago" / "2d ago" — used by the Overview's Recent Activity
// feed, which is built from real records (discount requests, refunds,
// registrations) rather than a canned placeholder list.
function formatRelativeTime(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// Lightweight bar chart, no charting library — plain divs sized with
// percentage height, consistent with the rest of the app's zero-dependency
// approach (see the inline SVG icons below).
function RevenueBarChart({ data }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-slate-500">No data for this range.</p>
  }
  const max = Math.max(...data.map((d) => Number(d.revenue)), 1)
  return (
    <div className="flex items-end gap-3 overflow-x-auto border-b border-gray-300 dark:border-slate-700 pb-0 pt-6">
      {data.map((d) => {
        const heightPct = Math.max((Number(d.revenue) / max) * 100, 3)
        return (
          <div key={d.month} className="flex w-20 flex-shrink-0 flex-col items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-medium text-gray-600 dark:text-slate-400">{formatPeso(d.revenue)}</span>
            <div className="flex h-40 w-full items-end justify-center rounded-t-md bg-gray-50 dark:bg-slate-800">
              <div
                className="w-12 rounded-t-md bg-teal-600"
                style={{ height: `${heightPct}%` }}
                title={`${formatMonthLabel(d.month)}: ${formatPeso(d.revenue)} across ${d.count} booking${d.count === 1 ? '' : 's'}`}
              />
            </div>
            <span className="whitespace-nowrap text-[11px] font-medium text-gray-600 dark:text-slate-400">{formatMonthLabel(d.month)}</span>
            <span className="whitespace-nowrap text-[10px] text-gray-400 dark:text-slate-500">{d.count} booking{d.count === 1 ? '' : 's'}</span>
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

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">Could not load image.</p>
  if (!url) return <p className="text-sm text-gray-500 dark:text-slate-500">Loading image...</p>
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
function IconLogout(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l5-5-5-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H9" />
    </svg>
  )
}
function IconChevron(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
    </svg>
  )
}
function IconSun(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
function IconMoon(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
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
]

// Groups the flat TABS list for the sidebar so related sections read as one
// unit at a glance — purely a rendering grouping, tab ids/logic are untouched.
const TAB_GROUPS = [
  { label: null, ids: ['overview'] },
  { label: 'Operations', ids: ['ferries', 'customers', 'discounts', 'bookings', 'refunds', 'manifest'] },
  { label: 'Insights', ids: ['analytics'] },
]

export default function Admin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  // Remembers the admin's collapsed/expanded preference across visits — a
  // small quality-of-life touch for anyone on a smaller laptop screen who'd
  // rather have the extra width than the full labels.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('adminSidebarCollapsed') === '1'
  )
  useEffect(() => {
    localStorage.setItem('adminSidebarCollapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  // Mobile tab strip has more tabs than fit on a phone screen at once, so it
  // scrolls horizontally — but a bare `overflow-x-auto` isn't discoverable
  // (nothing hints there's more to the right, and if a swipe gets missed
  // there's no other way to get to it). These track scroll position so we
  // can show/hide explicit left/right buttons instead of relying on swipe.
  const mobileNavRef = useRef(null)
  const [mobileNavAtStart, setMobileNavAtStart] = useState(true)
  const [mobileNavAtEnd, setMobileNavAtEnd] = useState(false)
  function updateMobileNavScroll() {
    const el = mobileNavRef.current
    if (!el) return
    setMobileNavAtStart(el.scrollLeft <= 4)
    setMobileNavAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
  }
  useEffect(() => {
    updateMobileNavScroll()
  }, [])

  // Opt-in dark mode for the dashboard only — off by default so the site's
  // regular light branding is unaffected, remembered per-admin via
  // localStorage. The `.dark` class is applied to this page's own root div
  // below (not <html>), so it can never leak into the customer-facing pages.
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('adminDarkMode') === '1'
  )
  useEffect(() => {
    localStorage.setItem('adminDarkMode', darkMode ? '1' : '0')
  }, [darkMode])

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      navigate('/login')
    }
  }, [navigate])

  async function logout() {
    try {
      await api.adminLogout()
    } catch {
      // best-effort — log out locally regardless of whether the server call succeeded
    }
    localStorage.removeItem('adminToken')
    navigate('/login')
  }

  const idleTimerRef = useRef(null)

  useEffect(() => {
    const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000 // 2 hours

    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(logout, IDLE_LIMIT_MS)
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    activityEvents.forEach((event) => window.addEventListener(event, resetIdleTimer))
    resetIdleTimer()

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, resetIdleTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

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
  // Set alongside the fare itself, so a discount rate is always declared at
  // the same time as the price it applies to. Defaults match the flat 20%
  // rate this replaces, so leaving them untouched keeps prior behavior.
  const [scheduleSeniorDiscount, setScheduleSeniorDiscount] = useState('20')
  const [schedulePwdDiscount, setSchedulePwdDiscount] = useState('20')
  const [scheduleStudentDiscount, setScheduleStudentDiscount] = useState('20')
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
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all') // 'all' | 'verified' | 'unverified' — set by clicking a Customer Directory summary tile
  const [expandedCustomerId, setExpandedCustomerId] = useState(null) // which row in the Customer Directory has its full-detail panel open
  const [discountTypeFilter, setDiscountTypeFilter] = useState('all') // 'all' | 'student' | 'senior' | 'pwd' — set by clicking a Profile Verification summary tile
  const [expandedDiscountId, setExpandedDiscountId] = useState(null) // which pending verification request is expanded (collapsed by default so a long queue stays scannable)
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all') // 'all' | a BookingStatus value — set by clicking an All Bookings summary tile
  const [bookingTripFilter, setBookingTripFilter] = useState('all') // 'all' | a scheduleId — narrows All Bookings down to one sailing

  const [allBookings, setAllBookings] = useState([])
  const [bookingsMessage, setBookingsMessage] = useState('')
  const [bookingSearch, setBookingSearch] = useState('')

  const [refundRequests, setRefundRequests] = useState([])
  const [refundsMessage, setRefundsMessage] = useState('')
  const [processingRefundId, setProcessingRefundId] = useState(null)
  const [expandedRefundId, setExpandedRefundId] = useState(null) // which refund request is expanded (collapsed by default so a long queue stays scannable)
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
  const [expandedOverviewStat, setExpandedOverviewStat] = useState(null) // which Overview StatCard's detail panel is open
  const [showAllActivity, setShowAllActivity] = useState(false) // Recent Activity: false = first 5 only, true = everything

  // Two-factor auth is mandatory and managed by IT directly (not
  // self-service from this dashboard) — `adminInfo` is still loaded for the
  // sidebar footer's name/email and initial, just without the enable/disable
  // UI that used to live in a Security tab here.
  const [adminInfo, setAdminInfo] = useState(null) // { id, email, name, twoFactorEnabled }

  // Loaded eagerly on mount (not lazily per-tab) since the Overview stat
  // cards need all of these regardless of which tab is active. Customers and
  // adminInfo were added here too so the Overview KPIs and header can show
  // real numbers immediately instead of waiting for those tabs to be opened.
  useEffect(() => {
    loadFerries()
    loadSchedules()
    loadPendingDiscounts()
    loadRefundRequests()
    loadAnalytics()
    loadCustomers()
    loadAdminInfo()
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
    if (
      !scheduleFerryId || !scheduleDate || !scheduleTime || !scheduleFare
      || scheduleSeniorDiscount === '' || schedulePwdDiscount === '' || scheduleStudentDiscount === ''
    ) {
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
        senior_discount_percent: parseFloat(scheduleSeniorDiscount),
        pwd_discount_percent: parseFloat(schedulePwdDiscount),
        student_discount_percent: parseFloat(scheduleStudentDiscount),
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

  async function loadAdminInfo() {
    try {
      const data = await api.getAdminMe()
      setAdminInfo(data)
    } catch (err) {
      console.error('Failed to load admin info:', err)
    }
  }

  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonth = analytics.find((m) => m.month === currentMonthKey)
  const thisMonthRevenue = thisMonth ? Number(thisMonth.revenue) : 0
  const thisMonthCount = thisMonth ? thisMonth.count : 0

  // Previous calendar month, for the "vs last month" hint on the Overview
  // revenue tile — purely derived from data already loaded for Analytics.
  const prevMonthKey = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()
  const prevMonthEntry = analytics.find((m) => m.month === prevMonthKey)
  const revenueChangePct =
    prevMonthEntry && Number(prevMonthEntry.revenue) > 0
      ? ((thisMonthRevenue - Number(prevMonthEntry.revenue)) / Number(prevMonthEntry.revenue)) * 100
      : null

  const allTimeRevenue = analytics.reduce((sum, m) => sum + Number(m.revenue), 0)
  const allTimeBookings = analytics.reduce((sum, m) => sum + m.count, 0)
  const verifiedCustomerCount = customers.filter(isCustomerDiscountVerified).length

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

  // Small live counts surfaced directly in the nav so an admin can see
  // what needs attention without first clicking into Overview.
  const tabBadges = {
    discounts: pendingDiscounts.length,
    refunds: refundRequests.length,
  }
  // Built from records already loaded for other tabs (no extra API calls) —
  // real recent events instead of a placeholder activity feed.
  const activityDotColor = {
    verification: 'bg-purple-500',
    refund: 'bg-blue-500',
    customer: 'bg-teal-500',
  }
  const recentActivity = [
    ...pendingDiscounts.map((d) => ({
      type: 'verification',
      text: `${d.name} requested ${d.discountType} verification`,
      date: d.createdAt,
    })),
    ...refundRequests.map((b) => ({
      type: 'refund',
      text: `Refund requested for booking ${b.referenceCode}`,
      date: b.createdAt,
    })),
    ...customers.map((c) => ({
      type: 'customer',
      text: `${fullName(c)} registered an account`,
      date: c.createdAt,
    })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    // No cap here anymore — the Recent Activity card below shows the first 5
    // and reveals the rest behind a "Show more" toggle, so this can safely
    // hold hundreds/thousands of entries without the list overwhelming the
    // page.

  // Extra context surfaced when an Overview StatCard is expanded — all
  // derived from data already loaded for other tabs, no extra API calls.
  const pendingByType = pendingDiscounts.reduce((acc, d) => {
    acc[d.discountType] = (acc[d.discountType] || 0) + 1
    return acc
  }, {})
  const refundTotalAmount = refundRequests.reduce((sum, b) => sum + Number(b.totalFare), 0)
  const oldestRefund = refundRequests.length > 0
    ? refundRequests.reduce((oldest, b) => (new Date(b.createdAt) < new Date(oldest.createdAt) ? b : oldest))
    : null
  const oldestRefundDays = oldestRefund ? Math.floor((Date.now() - new Date(oldestRefund.createdAt).getTime()) / 86400000) : 0
  const avgFareThisMonth = thisMonthCount > 0 ? thisMonthRevenue / thisMonthCount : 0
  const prevMonthCount = prevMonthEntry ? prevMonthEntry.count : 0
  const bookingsChangeCount = thisMonthCount - prevMonthCount
  const customerPendingCount = customers.filter((c) => c.discountStatus === 'pending').length
  const customerOtherCount = customers.length - verifiedCustomerCount - customerPendingCount
  const avgFareAllTime = allTimeBookings > 0 ? allTimeRevenue / allTimeBookings : 0
  const avgBookingsPerMonth = analytics.length > 0 ? allTimeBookings / analytics.length : 0

  // Breakdown for the Profile Verification summary strip — how the pending
  // queue splits by discount type, so the admin knows what's waiting before
  // opening a single request.
  const pendingByDiscountTypeCount = {
    student: pendingDiscounts.filter((d) => d.discountType === 'student').length,
    senior: pendingDiscounts.filter((d) => d.discountType === 'senior').length,
    pwd: pendingDiscounts.filter((d) => d.discountType === 'pwd').length,
  }

  // All Bookings summary tiles — how many bookings sit in each status.
  const bookingStatusCounts = allBookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {})
  // Distinct sailings that actually have bookings, soonest first, for the
  // "filter to one trip" dropdown.
  const bookingTripOptions = Object.values(
    allBookings.reduce((acc, b) => {
      if (b.schedule && !acc[b.scheduleId]) acc[b.scheduleId] = b.schedule
      return acc
    }, {})
  ).sort((a, b) => new Date(a.departureDatetime) - new Date(b.departureDatetime))
  // Bookings that need admin action float to the top; settled ones sink to
  // the bottom — same "attention first" ordering used elsewhere in this
  // dashboard (Customer Directory, Profile Verification).
  const bookingStatusPriority = { refund_requested: 0, pending_payment: 1, payment_declined: 2, confirmed: 3, cancelled: 4, refunded: 5 }

  // "Fleet at a Glance" detail — per-ferry sailing counts and next departure,
  // built from the ferries/schedules already loaded for the Ferries tab.
  const directionLabel = {
    PB_TO_LIMASAWA: 'Padre Burgos → Limasawa',
    LIMASAWA_TO_PB: 'Limasawa → Padre Burgos',
  }
  const now = new Date()
  const upcomingSchedules = schedules.filter((s) => new Date(s.departureDatetime) >= now)
  const totalFleetCapacity = ferries.reduce((sum, f) => sum + f.seatCapacity, 0)
  const fleetDetail = ferries.map((f) => {
    const ferrySchedules = schedules.filter((s) => (s.ferry?.id || s.ferryId) === f.id)
    const nextDeparture = ferrySchedules
      .filter((s) => new Date(s.departureDatetime) >= now)
      .sort((a, b) => new Date(a.departureDatetime) - new Date(b.departureDatetime))[0] || null
    return { ...f, scheduleCount: ferrySchedules.length, nextDeparture }
  })

  return (
    <div className={`flex min-h-screen bg-gray-50 dark:bg-slate-950 ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar — full-height, fixed to the left edge on sm+ screens so it
          stays put while the content scrolls. Hidden below sm; mobile gets
          its own compact top bar + horizontal tab strip instead, since a
          fixed full-height rail doesn't work well on a narrow screen. */}
      <aside
        className={`hidden bg-teal-950 shadow-xl transition-[width] duration-200 print:hidden sm:fixed sm:inset-y-0 sm:left-0 sm:flex sm:flex-col ${
          sidebarCollapsed ? 'sm:w-16' : 'sm:w-60'
        }`}
      >
        <div className={sidebarCollapsed ? 'px-2 py-5' : 'px-5 py-5'}>
          <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
            <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'flex-col gap-2 text-center' : ''}`}>
              {/* Logo file is a wide horizontal lockup (palm icon + wordmark), not a
                  square mark — zoomed/cropped via background-position so just the
                  palm icon fills this square badge instead of squishing the whole
                  thing. White backing keeps it legible against the dark sidebar. */}
             <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
  <img src="/admin-evershine-logo.png" alt="Evershine" className="h-7 w-7 object-contain" />
</div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-teal-400">Evershine Booking</p>
                  <p className="truncate text-[15px] font-bold leading-tight text-white">Admin Panel</p>
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1 ${sidebarCollapsed ? 'flex-col' : ''}`}>
              <button
                onClick={() => setDarkMode((v) => !v)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-teal-900 hover:text-white"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-teal-900 hover:text-white"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <IconChevron className={`h-4 w-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {!sidebarCollapsed && (
            <p className="mt-3 text-xs text-slate-400">Padre Burgos &harr; Limasawa</p>
          )}
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto pb-4 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {TAB_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && !sidebarCollapsed && (
                <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              )}
              {group.label && sidebarCollapsed && <div className="my-2 border-t border-teal-900" />}
              {group.ids.map((id) => {
                const tab = TABS.find((t) => t.id === id)
                const Icon = tab.icon
                const active = activeTab === tab.id
                const badge = tabBadges[tab.id] || 0
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    title={sidebarCollapsed ? tab.label : undefined}
                    className={`group flex w-full items-center gap-2.5 rounded-md py-2 text-left text-sm font-medium transition-colors ${
                      sidebarCollapsed ? 'justify-center px-0' : 'px-2.5'
                    } ${active ? 'bg-teal-900 text-white' : 'text-slate-300 hover:bg-teal-900/60 hover:text-white'}`}
                  >
                    <span
                      className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors ${
                        active ? 'bg-teal-600 text-white' : 'bg-teal-900/50 text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {badge > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-teal-950">
                          {badge}
                        </span>
                      )}
                    </span>
                    {!sidebarCollapsed && <span className="whitespace-nowrap">{tab.label}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className={`border-t border-teal-900 py-4 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
          {!sidebarCollapsed && (
            <div className="rounded-md bg-teal-900/40 px-3 py-2.5" title={adminInfo?.email}>
              <p className="truncate text-sm font-semibold text-white">{adminInfo?.name || 'Administrator'}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{adminInfo?.email || 'Loading…'}</p>
            </div>
          )}
          <button
            onClick={logout}
            title={sidebarCollapsed ? (adminInfo?.email ? `Log Out (${adminInfo.email})` : 'Log Out') : undefined}
            className={`flex items-center justify-center gap-2 rounded-md border border-teal-800 py-2 text-sm font-medium text-slate-200 hover:bg-teal-900 ${
              sidebarCollapsed ? 'mx-auto mt-2 w-9 px-0' : 'mt-3 w-full px-3'
            }`}
          >
            <IconLogout className="h-4 w-4 flex-shrink-0" />
            {!sidebarCollapsed && 'Log Out'}
          </button>
        </div>
      </aside>

      {/* Content column — offset to the right of the fixed sidebar on sm+,
          matching whichever width the sidebar currently is. print:pl-0
          drops that offset when printing, since the sidebar is print:hidden
          and would otherwise leave a blank gutter on the left. */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-200 print:pl-0 ${
          sidebarCollapsed ? 'sm:pl-16' : 'sm:pl-60'
        }`}
      >
        {/* Mobile-only top bar — the fixed sidebar is hidden below sm, so
            identity + Log Out need a home here instead. */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 print:hidden sm:hidden">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Admin Dashboard</p>
            <p className="text-xs text-gray-500 dark:text-slate-500">Evershine Booking</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode((v) => !v)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
            </button>
            <button onClick={logout} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              Log Out
            </button>
          </div>
        </div>

        {/* Mobile-only horizontal tab strip — same tabs as the sidebar nav,
            just laid out for a narrow screen. Swiping works, but since that's
            easy to miss, explicit left/right buttons (shown only when
            there's actually more to scroll to) give a guaranteed way to
            reach every tab. */}
        <div className="relative flex items-stretch border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 print:hidden sm:hidden">
          {!mobileNavAtStart && (
            <button
              type="button"
              onClick={() => mobileNavRef.current?.scrollBy({ left: -150, behavior: 'smooth' })}
              aria-label="Scroll tabs left"
              className="flex flex-shrink-0 items-center justify-center border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-1.5 text-gray-500 dark:text-slate-400"
            >
              <IconChevron className="h-4 w-4" />
            </button>
          )}
          <nav
            ref={mobileNavRef}
            onScroll={updateMobileNavScroll}
            className="flex flex-1 gap-1 overflow-x-auto px-3 py-2"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              const badge = tabBadges[tab.id] || 0
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'bg-teal-700 text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {badge > 0 && (
                    <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ${
                      active ? 'bg-white dark:bg-slate-900/25 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
          {!mobileNavAtEnd && (
            <button
              type="button"
              onClick={() => mobileNavRef.current?.scrollBy({ left: 150, behavior: 'smooth' })}
              aria-label="Scroll tabs right"
              className="flex flex-shrink-0 items-center justify-center border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-1.5 text-gray-500 dark:text-slate-400"
            >
              <IconChevron className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>

        {/* Desktop-only slim title bar for the active section. Identity +
            Log Out now live in the sidebar, so this just orients the admin. */}
        <div className="hidden items-center justify-between border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 print:hidden sm:flex">
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h1>
        </div>

        <main className="flex-1 p-4 sm:p-6">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  label="Pending Verifications"
                  value={pendingDiscounts.length}
                  accent="purple"
                  active={expandedOverviewStat === 'pending'}
                  onClick={() => setExpandedOverviewStat(expandedOverviewStat === 'pending' ? null : 'pending')}
                />
                <StatCard
                  label="Refund Requests"
                  value={refundRequests.length}
                  accent="blue"
                  active={expandedOverviewStat === 'refunds'}
                  onClick={() => setExpandedOverviewStat(expandedOverviewStat === 'refunds' ? null : 'refunds')}
                />
                <StatCard
                  label="This Month's Revenue"
                  value={`₱${thisMonthRevenue.toLocaleString()}`}
                  accent="teal"
                  hint={
                    revenueChangePct === null
                      ? undefined
                      : `${revenueChangePct >= 0 ? '▲' : '▼'} ${Math.abs(revenueChangePct).toFixed(0)}% vs last month`
                  }
                  active={expandedOverviewStat === 'revenue'}
                  onClick={() => setExpandedOverviewStat(expandedOverviewStat === 'revenue' ? null : 'revenue')}
                />
                <StatCard
                  label="This Month's Bookings"
                  value={thisMonthCount}
                  accent="blue"
                  active={expandedOverviewStat === 'bookings'}
                  onClick={() => setExpandedOverviewStat(expandedOverviewStat === 'bookings' ? null : 'bookings')}
                />
                <StatCard
                  label="Registered Customers"
                  value={customers.length}
                  accent="amber"
                  hint={`${verifiedCustomerCount} discount-verified`}
                  active={expandedOverviewStat === 'customers'}
                  onClick={() => setExpandedOverviewStat(expandedOverviewStat === 'customers' ? null : 'customers')}
                />
                <StatCard
                  label="All-Time Bookings"
                  value={allTimeBookings}
                  accent="purple"
                  hint={`${formatPeso(allTimeRevenue)} total revenue`}
                  active={expandedOverviewStat === 'alltime'}
                  onClick={() => setExpandedOverviewStat(expandedOverviewStat === 'alltime' ? null : 'alltime')}
                />
              </div>

              {expandedOverviewStat && (
                <Card className="bg-teal-50 dark:bg-teal-900/20">
                  {expandedOverviewStat === 'pending' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      {pendingDiscounts.length === 0 ? (
                        'No verification requests waiting right now.'
                      ) : (
                        <>
                          <b>{pendingDiscounts.length}</b> profile verification request{pendingDiscounts.length === 1 ? '' : 's'} waiting
                          {Object.keys(pendingByType).length > 0 && (
                            <> — {['senior', 'pwd', 'student'].filter((t) => pendingByType[t]).map((t) => `${pendingByType[t]} ${t}`).join(', ')}</>
                          )}
                          .{' '}
                          <button onClick={() => setActiveTab('discounts')} className="font-medium text-teal-700 dark:text-teal-300 underline underline-offset-2">
                            Review now &rarr;
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  {expandedOverviewStat === 'refunds' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      {refundRequests.length === 0 ? (
                        'No refund requests waiting right now.'
                      ) : (
                        <>
                          <b>{refundRequests.length}</b> refund request{refundRequests.length === 1 ? '' : 's'} totaling <b>{formatPeso(refundTotalAmount)}</b>.
                          {' '}The oldest has been waiting {oldestRefundDays === 0 ? 'less than a day' : `${oldestRefundDays} day${oldestRefundDays === 1 ? '' : 's'}`}.
                          {' '}
                          <button onClick={() => setActiveTab('refunds')} className="font-medium text-teal-700 dark:text-teal-300 underline underline-offset-2">
                            Review now &rarr;
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  {expandedOverviewStat === 'revenue' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <b>{formatPeso(thisMonthRevenue)}</b> collected this month from {thisMonthCount} booking{thisMonthCount === 1 ? '' : 's'}
                      {thisMonthCount > 0 && <> — averaging <b>{formatPeso(avgFareThisMonth)}</b> per booking</>}.
                      {prevMonthEntry && (
                        <>
                          {' '}Last month brought in {formatPeso(Number(prevMonthEntry.revenue))}
                          {revenueChangePct !== null && <>, so this month is {revenueChangePct >= 0 ? 'up' : 'down'} {Math.abs(revenueChangePct).toFixed(0)}%.</>}
                        </>
                      )}
                    </p>
                  )}
                  {expandedOverviewStat === 'bookings' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <b>{thisMonthCount}</b> booking{thisMonthCount === 1 ? '' : 's'} so far this month
                      {prevMonthEntry && (
                        <> compared to {prevMonthCount} last month ({bookingsChangeCount >= 0 ? '+' : ''}{bookingsChangeCount})</>
                      )}
                      .
                    </p>
                  )}
                  {expandedOverviewStat === 'customers' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <b>{customers.length}</b> registered customer{customers.length === 1 ? '' : 's'} — <b>{verifiedCustomerCount}</b> discount-verified,{' '}
                      <b>{customerPendingCount}</b> pending review, {customerOtherCount} with no active discount.
                    </p>
                  )}
                  {expandedOverviewStat === 'alltime' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <b>{allTimeBookings}</b> confirmed booking{allTimeBookings === 1 ? '' : 's'} all-time, totaling <b>{formatPeso(allTimeRevenue)}</b>
                      {allTimeBookings > 0 && <> — averaging <b>{formatPeso(avgFareAllTime)}</b> per booking</>}
                      {analytics.length > 0 && (
                        <> across {analytics.length} month{analytics.length === 1 ? '' : 's'} of recorded sales (~{avgBookingsPerMonth.toFixed(1)}/month)</>
                      )}
                      .
                    </p>
                  )}
                </Card>
              )}

              {(pendingDiscounts.length > 0 || refundRequests.length > 0) && (
                <Card title="Needs Your Attention">
                  <div className="space-y-2">
                    {pendingDiscounts.length > 0 && (
                      <button
                        onClick={() => setActiveTab('discounts')}
                        className="flex w-full items-center justify-between rounded-md border border-purple-200 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 px-3.5 py-2.5 text-left text-sm hover:bg-purple-100 dark:hover:bg-purple-500/20"
                      >
                        <span className="font-medium text-purple-800 dark:text-purple-300">
                          {pendingDiscounts.length} verification request{pendingDiscounts.length === 1 ? '' : 's'} awaiting review
                        </span>
                        <span className="text-purple-700 dark:text-purple-300">Review &rarr;</span>
                      </button>
                    )}
                    {refundRequests.length > 0 && (
                      <button
                        onClick={() => setActiveTab('refunds')}
                        className="flex w-full items-center justify-between rounded-md border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-3.5 py-2.5 text-left text-sm hover:bg-blue-100 dark:hover:bg-blue-500/20"
                      >
                        <span className="font-medium text-blue-800 dark:text-blue-300">
                          {refundRequests.length} refund request{refundRequests.length === 1 ? '' : 's'} awaiting review
                        </span>
                        <span className="text-blue-700 dark:text-blue-300">Review &rarr;</span>
                      </button>
                    )}
                  </div>
                </Card>
              )}

              <Card title="Recent Activity">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-500">Nothing to show yet.</p>
                ) : (
                  <>
                    <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                      {(showAllActivity ? recentActivity : recentActivity.slice(0, 5)).map((item, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${activityDotColor[item.type]}`} />
                            <span className="truncate text-sm text-gray-700 dark:text-slate-300">{item.text}</span>
                          </div>
                          <span className="flex-shrink-0 text-xs text-gray-400 dark:text-slate-500">
                            {formatRelativeTime(item.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {recentActivity.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllActivity((v) => !v)}
                        className="mt-3 w-full rounded-md border border-gray-200 dark:border-slate-800 py-2 text-center text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-gray-50 dark:hover:bg-slate-800/60"
                      >
                        {showAllActivity ? 'Show less' : `Show ${recentActivity.length - 5} more`}
                      </button>
                    )}
                  </>
                )}
              </Card>

              <Card title="Fleet at a Glance">
                {ferries.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-500">No ferries registered yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-slate-800 rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40">
                      <div className="px-3 py-2.5 text-center">
                        <p className="text-lg font-bold leading-none text-gray-900 dark:text-white">{ferries.length}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Vessels</p>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <p className="text-lg font-bold leading-none text-gray-900 dark:text-white">{totalFleetCapacity}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Combined Seats</p>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <p className="text-lg font-bold leading-none text-gray-900 dark:text-white">{upcomingSchedules.length}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Upcoming Sailings</p>
                      </div>
                    </div>

                    <ul className="mt-3 divide-y divide-gray-100 dark:divide-slate-800">
                      {fleetDetail.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{f.name}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              {f.seatCapacity} seats &middot; {f.scheduleCount} sailing{f.scheduleCount === 1 ? '' : 's'} scheduled
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {f.nextDeparture ? (
                              <>
                                <p className="text-xs font-medium text-gray-700 dark:text-slate-300">
                                  {new Date(f.nextDeparture.departureDatetime).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-slate-500">
                                  {directionLabel[f.nextDeparture.direction] || f.nextDeparture.direction}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400 dark:text-slate-500">No upcoming sailings</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'ferries' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card title="Add Ferry">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Ferry Name</label>
                      <input
                        type="text"
                        placeholder="e.g. MV Evershine 3"
                        value={ferryName}
                        onChange={(e) => setFerryName(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Seat Capacity</label>
                      <input
                        type="number"
                        placeholder="e.g. 80"
                        value={ferryCapacity}
                        onChange={(e) => setFerryCapacity(e.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <button onClick={addFerry} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
                      Add Ferry
                    </button>
                    {ferryMessage && (
                      <p
                        className={`rounded-md border px-3 py-2 text-sm ${
                          ferryError
                            ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                            : 'border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                        }`}
                      >
                        {ferryMessage}
                      </p>
                    )}
                  </div>
                  <p className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-3 text-xs text-gray-500 dark:text-slate-500">
                    {ferries.length} vessel{ferries.length === 1 ? '' : 's'} registered &middot; {totalFleetCapacity} combined seats
                  </p>
                </Card>

                <Card title="Add Schedule">
                  {ferries.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-500">Add a ferry first before scheduling a sailing.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Ferry</label>
                          <select
                            value={scheduleFerryId}
                            onChange={(e) => setScheduleFerryId(e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            {ferries.map((f) => (
                              <option key={f.id} value={f.id}>{f.name} (cap. {f.seatCapacity})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Direction</label>
                          <select
                            value={scheduleDirection}
                            onChange={(e) => setScheduleDirection(e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="PB_TO_LIMASAWA">Padre Burgos &rarr; Limasawa</option>
                            <option value="LIMASAWA_TO_PB">Limasawa &rarr; Padre Burgos</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Date</label>
                          <input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Time</label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Fare (&#8369;)</label>
                        <input
                          type="number"
                          placeholder="e.g. 150"
                          value={scheduleFare}
                          onChange={(e) => setScheduleFare(e.target.value)}
                          className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">
                          Discounts (% off this fare)
                        </label>
                        <div className="mt-1 grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-slate-500">Senior Citizen</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={scheduleSeniorDiscount}
                              onChange={(e) => setScheduleSeniorDiscount(e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-slate-500">PWD</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={schedulePwdDiscount}
                              onChange={(e) => setSchedulePwdDiscount(e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-slate-500">Student</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={scheduleStudentDiscount}
                              onChange={(e) => setScheduleStudentDiscount(e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                          </div>
                        </div>
                      </div>
                      <button onClick={addSchedule} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
                        Add Schedule
                      </button>
                      {scheduleMessage && (
                        <p
                          className={`rounded-md border px-3 py-2 text-sm ${
                            scheduleError
                              ? 'border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                              : 'border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300'
                          }`}
                        >
                          {scheduleMessage}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </div>

              <Card title="All Schedules">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{schedules.length}</span> total sailing{schedules.length === 1 ? '' : 's'}
                    {' '}&middot;{' '}
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{upcomingSchedules.length}</span> upcoming
                  </p>
                  <button
                    onClick={loadSchedules}
                    className="rounded-md border border-gray-300 dark:border-slate-700 px-3.5 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Refresh List
                  </button>
                </div>
                {schedulesMessage && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{schedulesMessage}</p>}

                {schedules.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No sailings scheduled yet.</p>
                ) : (
                  <DataTable headers={['Date/Time', 'Direction', 'Fare', 'Discounts', 'Ferry', 'Status']}>
                    {schedules.map((s) => {
                      const isPast = new Date(s.departureDatetime) < now
                      return (
                        <tr key={s.id} className="border-t border-gray-100 dark:border-slate-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/30">
                          <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">
                            {new Date(s.departureDatetime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{directionLabel[s.direction] || s.direction}</td>
                          <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-slate-100">{formatPeso(s.baseFare)}</td>
                          <td className="px-3 py-1.5 text-xs text-gray-600 dark:text-slate-400">
                            Senior {s.seniorDiscountPercent}% &middot; PWD {s.pwdDiscountPercent}% &middot; Student {s.studentDiscountPercent}%
                          </td>
                          <td className="px-3 py-1.5 text-gray-600 dark:text-slate-400">{s.ferry ? `${s.ferry.name} (cap. ${s.ferry.seatCapacity})` : '—'}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isPast
                                  ? 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-500'
                                  : 'bg-teal-100 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300'
                              }`}
                            >
                              {isPast ? 'Past' : 'Upcoming'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </DataTable>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'discounts' && (
            <div className="space-y-5">
              <Card title="Profile Verification Requests">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Review the live selfie and ID against each applicant's details, then set how long their discount
                  stays valid before verifying or rejecting the request.
                </p>

                <div className="mt-3 grid grid-cols-2 divide-x divide-gray-200 dark:divide-slate-800 overflow-hidden rounded-md border border-gray-200 dark:border-slate-800 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setDiscountTypeFilter('all')}
                    className={`px-3 py-2.5 text-center transition-colors ${
                      discountTypeFilter === 'all'
                        ? 'bg-teal-700 dark:bg-teal-900/30'
                        : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <p className={`text-lg font-bold leading-none ${discountTypeFilter === 'all' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{pendingDiscounts.length}</p>
                    <p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${discountTypeFilter === 'all' ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>Pending</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountTypeFilter('student')}
                    className={`px-3 py-2.5 text-center transition-colors ${
                      discountTypeFilter === 'student'
                        ? 'bg-teal-700 dark:bg-teal-900/30'
                        : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <p className={`text-lg font-bold leading-none ${discountTypeFilter === 'student' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`}>{pendingByDiscountTypeCount.student}</p>
                    <p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${discountTypeFilter === 'student' ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>Student</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountTypeFilter('senior')}
                    className={`px-3 py-2.5 text-center transition-colors ${
                      discountTypeFilter === 'senior'
                        ? 'bg-teal-700 dark:bg-teal-900/30'
                        : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <p className={`text-lg font-bold leading-none ${discountTypeFilter === 'senior' ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>{pendingByDiscountTypeCount.senior}</p>
                    <p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${discountTypeFilter === 'senior' ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>Senior</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountTypeFilter('pwd')}
                    className={`px-3 py-2.5 text-center transition-colors ${
                      discountTypeFilter === 'pwd'
                        ? 'bg-teal-700 dark:bg-teal-900/30'
                        : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <p className={`text-lg font-bold leading-none ${discountTypeFilter === 'pwd' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>{pendingByDiscountTypeCount.pwd}</p>
                    <p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${discountTypeFilter === 'pwd' ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>PWD</p>
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <button onClick={loadPendingDiscounts} className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                  {discountTypeFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setDiscountTypeFilter('all')}
                      className="whitespace-nowrap rounded-md border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
                    >
                      Clear filter &times;
                    </button>
                  )}
                </div>
                {discountsMessage && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{discountsMessage}</p>}

                {(() => {
                  const visibleDiscounts =
                    discountTypeFilter === 'all' ? pendingDiscounts : pendingDiscounts.filter((c) => c.discountType === discountTypeFilter)

                  return pendingDiscounts.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No pending verification requests right now.</p>
                  ) : visibleDiscounts.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No pending requests match this filter.</p>
                  ) : (
                  <div className="mt-4 space-y-3">
                    {visibleDiscounts.map((c) => {
                      const initials = c.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || '?'
                      const discountBadge = {
                        student: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300',
                        senior: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300',
                        pwd: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
                      }[c.discountType] || 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                      const chosenDate = expiryDates[c.id] || ''
                      const isOpen = expandedDiscountId === c.id

                      function setQuickExpiry(months) {
                        const d = new Date()
                        d.setMonth(d.getMonth() + months)
                        setExpiryDates((prev) => ({ ...prev, [c.id]: d.toISOString().slice(0, 10) }))
                      }

                      return (
                        <div key={c.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setExpandedDiscountId(isOpen ? null : c.id)}
                            className={`flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left transition-colors sm:p-5 ${
                              isOpen ? 'bg-gray-50 dark:bg-slate-800/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-500/15 text-sm font-semibold text-teal-700 dark:text-teal-300">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800 dark:text-slate-100">{c.name}</p>
                                <p className="text-sm text-gray-500 dark:text-slate-500">
                                  {c.email}{c.contactNumber ? ` · ${c.contactNumber}` : ''}
                                </p>
                                {c.createdAt && (
                                  <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                                    Submitted {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold capitalize ${discountBadge}`}>
                                {c.discountType} discount
                              </span>
                              <span className="whitespace-nowrap text-xs font-medium text-teal-700 dark:text-teal-300">
                                {isOpen ? 'Hide details' : 'View details'}
                              </span>
                            </div>
                          </button>

                          {isOpen && (
                          <div className="border-t border-gray-100 dark:border-slate-800 p-4 sm:p-5">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Verification Documents</p>
                            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                              <div className="rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 p-2.5">
                                <p className="text-xs font-medium text-gray-500 dark:text-slate-500">Live Selfie</p>
                                {c.selfiePath ? (
                                  <AdminImage
                                    path={c.selfiePath}
                                    alt="Live selfie"
                                    expandable
                                    className="mt-1.5 max-h-48 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 object-contain"
                                  />
                                ) : (
                                  <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-500">No selfie captured.</p>
                                )}
                              </div>
                              <div className="rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 p-2.5">
                                <p className="text-xs font-medium text-gray-500 dark:text-slate-500">ID (Front)</p>
                                {c.discountIdPath ? (
                                  <AdminImage
                                    path={c.discountIdPath}
                                    alt="ID front"
                                    expandable
                                    className="mt-1.5 max-h-48 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 object-contain"
                                  />
                                ) : (
                                  <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-500">No ID uploaded.</p>
                                )}
                              </div>
                              <div className="rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 p-2.5">
                                <p className="text-xs font-medium text-gray-500 dark:text-slate-500">ID (Back)</p>
                                {c.discountIdBackPath ? (
                                  <AdminImage
                                    path={c.discountIdBackPath}
                                    alt="ID back"
                                    expandable
                                    className="mt-1.5 max-h-48 w-full rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 object-contain"
                                  />
                                ) : (
                                  <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-500">No back-of-ID uploaded.</p>
                                )}
                              </div>
                            </div>

                            <div className="mt-4 rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 p-3.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Verification Decision</p>
                              <label className="mt-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                                Valid until <span className="font-normal text-gray-400 dark:text-slate-500">(check the expiry printed on their ID)</span>
                              </label>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <input
                                  type="date"
                                  value={chosenDate}
                                  onChange={(e) => setExpiryDates((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                  className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                                <button type="button" onClick={() => setQuickExpiry(6)} className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  +6 mo
                                </button>
                                <button type="button" onClick={() => setQuickExpiry(12)} className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  +1 yr
                                </button>
                                <button type="button" onClick={() => setQuickExpiry(24)} className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800">
                                  +2 yrs
                                </button>
                                {chosenDate && (
                                  <span className="text-xs text-gray-500 dark:text-slate-500">
                                    Valid through {new Date(`${chosenDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  onClick={() => verifyDiscount(c.id)}
                                  disabled={!chosenDate}
                                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-slate-400"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Reject ${c.name}'s ${c.discountType} discount request?`)) rejectDiscount(c.id)
                                  }}
                                  className="rounded-md border border-red-200 dark:border-red-500/30 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  Reject
                                </button>
                              </div>
                              {!chosenDate && (
                                <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">Pick an expiry date (or use a shortcut above) to enable Verify.</p>
                              )}
                            </div>
                          </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  )
                })()}
              </Card>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-5">
              <Card title="Customer Directory">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Every registered account — verified or not — so you can look up contact details (e.g. to send an
                  invoice) without digging through bookings.
                </p>

                <div className="mt-3 grid grid-cols-3 divide-x divide-gray-200 dark:divide-slate-800 overflow-hidden rounded-md border border-gray-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCustomerStatusFilter('all')}
                    className={`px-3 py-2.5 text-center transition-colors ${
                      customerStatusFilter === 'all'
                        ? 'bg-teal-700 dark:bg-teal-900/30'
                        : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                  <p className={`text-lg font-bold leading-none ${customerStatusFilter === 'all' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{customers.length}</p>
<p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${customerStatusFilter === 'all' ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>Registered</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerStatusFilter('verified')}
                    className={`px-3 py-2.5 text-center transition-colors ${
                      customerStatusFilter === 'verified'
                        ? 'bg-teal-700 dark:bg-teal-900/30'
                        : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                <p className={`text-lg font-bold leading-none ${customerStatusFilter === 'verified' ? 'text-white' : 'text-green-600 dark:text-green-400'}`}>{verifiedCustomerCount}</p>
<p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${customerStatusFilter === 'verified' ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>Verified</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerStatusFilter('unverified')}
                    className={`px-3 py-2.5 text-center transition-colors ${
                      customerStatusFilter === 'unverified'
                        ? 'bg-teal-700 dark:bg-teal-900/30'
                        : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }`}
                  >
                   <p className={`text-lg font-bold leading-none ${customerStatusFilter === 'unverified' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`}>{customers.length - verifiedCustomerCount}</p>
<p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${customerStatusFilter === 'unverified' ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>Not Verified</p>
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={loadCustomers} className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by name, email, or contact number..."
                    className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {customerStatusFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setCustomerStatusFilter('all')}
                      className="whitespace-nowrap rounded-md border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
                    >
                      Clear filter &times;
                    </button>
                  )}
                </div>
                {customersMessage && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{customersMessage}</p>}

                {(() => {
                  const query = customerSearch.trim().toLowerCase()
                  const statusFiltered =
                    customerStatusFilter === 'verified'
                      ? customers.filter(isCustomerDiscountVerified)
                      : customerStatusFilter === 'unverified'
                      ? customers.filter((c) => !isCustomerDiscountVerified(c))
                      : customers
                  const filtered = !query
                    ? statusFiltered
                    : statusFiltered.filter((c) => {
                        const name = fullName(c).toLowerCase()
                        return (
                          name.includes(query) ||
                          c.email.toLowerCase().includes(query) ||
                          (c.contactNumber || '').toLowerCase().includes(query)
                        )
                      })

                  const discountBadgeStyles = {
                    verified: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300',
                    pending: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300',
                    rejected: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300',
                    expired: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300',
                    none: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400',
                  }

                  function effectiveStatus(c) {
                    if (c.discountStatus === 'verified' && c.discountVerifiedUntil && new Date(c.discountVerifiedUntil) < new Date()) {
                      return 'expired'
                    }
                    return c.discountStatus
                  }

                  // Verified accounts first, then pending, then the rest — so the
                  // admin sees who's already trusted before scanning the full list.
                  const statusPriority = { verified: 0, pending: 1, expired: 2, rejected: 3, none: 4 }
                  const sorted = [...filtered].sort((a, b) => {
                    const pa = statusPriority[effectiveStatus(a)] ?? 5
                    const pb = statusPriority[effectiveStatus(b)] ?? 5
                    if (pa !== pb) return pa - pb
                    return fullName(a).localeCompare(fullName(b))
                  })

                  return sorted.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">
                      {customers.length === 0
                        ? 'No registered customers yet.'
                        : query
                        ? 'No customers match that search.'
                        : 'No customers match this filter.'}
                    </p>
                  ) : (
                    <DataTable headers={['Name', 'Contact', 'Address', 'Profile Status', 'Registered']}>
                      {sorted.map((c) => {
                        const status = effectiveStatus(c)
                        const address = [c.barangay, c.cityMunicipality, c.province, c.zipCode, c.region]
                          .filter(Boolean)
                          .join(', ')
                        const isOpen = expandedCustomerId === c.id
                        const customerBookings = isOpen ? allBookings.filter((b) => b.customerId === c.id) : []

                        function toggleExpanded() {
                          const next = isOpen ? null : c.id
                          setExpandedCustomerId(next)
                          if (next && allBookings.length === 0) loadAllBookings()
                        }

                        return (
                          <Fragment key={c.id}>
                            <tr
                              onClick={toggleExpanded}
                              className={`cursor-pointer border-t border-gray-100 dark:border-slate-800 align-top transition-colors ${
                                isOpen ? 'bg-teal-50/70 dark:bg-teal-900/20' : 'hover:bg-teal-50/50 dark:hover:bg-teal-900/30'
                              }`}
                            >
                              <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-slate-100">{fullName(c)}</td>
                              <td className="px-3 py-1.5">
                                <p className="text-gray-700 dark:text-slate-300">{c.email}</p>
                                <p className="text-gray-500 dark:text-slate-500">{c.contactNumber || '—'}</p>
                              </td>
                              <td className="px-3 py-1.5 max-w-[220px] text-gray-600 dark:text-slate-400">{address || '—'}</td>
                              <td className="px-3 py-1.5">
                                <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${discountBadgeStyles[status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'}`}>
                                  {status}
                                </span>
                                {status === 'verified' && c.discountType !== 'none' && (
                                  <p className="mt-0.5 whitespace-nowrap text-xs capitalize text-gray-500 dark:text-slate-500">{c.discountType} discount</p>
                                )}
                              </td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-gray-600 dark:text-slate-400">
                                {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="bg-teal-50/40 dark:bg-teal-900/10">
                                <td colSpan={5} className="border-t border-teal-100 dark:border-teal-900/40 px-4 py-4">
                                  <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Full Name</p>
                                      <p className="mt-0.5 text-sm text-gray-800 dark:text-slate-100">
                                        {fullName(c)}{c.suffix ? ` ${c.suffix}` : ''}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Email</p>
                                      <p className="mt-0.5 text-sm text-gray-800 dark:text-slate-100">{c.email}</p>
                                      <p className="text-xs text-gray-500 dark:text-slate-500">{c.emailVerified ? 'Verified' : 'Not verified'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Contact Number</p>
                                      <p className="mt-0.5 text-sm text-gray-800 dark:text-slate-100">{c.contactNumber || '—'}</p>
                                    </div>
                                    <div className="sm:col-span-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Full Address</p>
                                      <p className="mt-0.5 text-sm text-gray-800 dark:text-slate-100">{address || 'Not provided'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Registered On</p>
                                      <p className="mt-0.5 text-sm text-gray-800 dark:text-slate-100">
                                        {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Discount Type</p>
                                      <p className="mt-0.5 text-sm capitalize text-gray-800 dark:text-slate-100">
                                        {c.discountType && c.discountType !== 'none' ? c.discountType : 'None requested'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Discount Status</p>
                                      <span className={`mt-0.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ${discountBadgeStyles[status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'}`}>
                                        {status}
                                      </span>
                                    </div>
                                    {status === 'verified' && c.discountVerifiedUntil && (
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Verified Until</p>
                                        <p className="mt-0.5 text-sm text-gray-800 dark:text-slate-100">
                                          {new Date(c.discountVerifiedUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-5 border-t border-teal-100 dark:border-teal-900/40 pt-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">Booking History</p>
                                    {customerBookings.length === 0 ? (
                                      <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-500">No bookings placed under this account yet.</p>
                                    ) : (
                                      <div className="mt-2 space-y-2">
                                        {customerBookings.map((b) => (
                                          <div
                                            key={b.id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono text-xs font-semibold text-gray-700 dark:text-slate-300">{b.referenceCode}</span>
                                              <StatusBadge status={b.status} />
                                            </div>
                                            <span className="text-xs text-gray-500 dark:text-slate-500">
                                              {b.schedule
                                                ? `${directionLabel[b.schedule.direction] || b.schedule.direction} · ${new Date(
                                                    b.schedule.departureDatetime
                                                  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                                                : '—'}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">{formatPeso(b.totalFare)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </DataTable>
                  )
                })()}
              </Card>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-5">
              <Card title="All Bookings">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Includes guest checkouts — bookings made without an account still show the contact email and
                  number entered at checkout, so you can reach anyone who's booked, verified account or not.
                </p>

                <div className="mt-3 grid grid-cols-2 divide-x divide-gray-200 dark:divide-slate-800 overflow-hidden rounded-md border border-gray-200 dark:border-slate-800 sm:grid-cols-4 lg:grid-cols-7">
                  {[
                    { key: 'all', label: 'All', count: allBookings.length, tone: 'text-gray-900 dark:text-white' },
                    { key: 'refund_requested', label: 'Refund Req.', count: bookingStatusCounts.refund_requested || 0, tone: 'text-blue-600 dark:text-blue-400' },
                    { key: 'pending_payment', label: 'Pending Pmt.', count: bookingStatusCounts.pending_payment || 0, tone: 'text-yellow-600 dark:text-yellow-400' },
                    { key: 'payment_declined', label: 'Declined', count: bookingStatusCounts.payment_declined || 0, tone: 'text-red-600 dark:text-red-400' },
                    { key: 'confirmed', label: 'Confirmed', count: bookingStatusCounts.confirmed || 0, tone: 'text-green-600 dark:text-green-400' },
                    { key: 'refunded', label: 'Refunded', count: bookingStatusCounts.refunded || 0, tone: 'text-blue-600 dark:text-blue-400' },
                    { key: 'cancelled', label: 'Cancelled', count: bookingStatusCounts.cancelled || 0, tone: 'text-gray-500 dark:text-slate-400' },
                  ].map((tile) => {
                    const active = bookingStatusFilter === tile.key
                    return (
                      <button
                        key={tile.key}
                        type="button"
                        onClick={() => setBookingStatusFilter(tile.key)}
                        className={`px-3 py-2.5 text-center transition-colors ${
                          active ? 'bg-teal-700 dark:bg-teal-900/30' : 'bg-gray-50/60 dark:bg-slate-800/40 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <p className={`text-lg font-bold leading-none ${active ? 'text-white' : tile.tone}`}>{tile.count}</p>
                        <p className={`mt-1 text-[11px] font-medium uppercase tracking-wide ${active ? 'text-teal-50' : 'text-gray-500 dark:text-slate-500'}`}>{tile.label}</p>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button onClick={loadAllBookings} className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                  <input
                    type="text"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Search by reference, email, contact number, or passenger..."
                    className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <select
                    value={bookingTripFilter}
                    onChange={(e) => setBookingTripFilter(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="all">All trips</option>
                    {bookingTripOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.departureDatetime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {' · '}
                        {directionLabel[s.direction] || s.direction}
                      </option>
                    ))}
                  </select>
                  {(bookingStatusFilter !== 'all' || bookingTripFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setBookingStatusFilter('all')
                        setBookingTripFilter('all')
                      }}
                      className="whitespace-nowrap rounded-md border border-teal-200 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-500/20"
                    >
                      Clear filters &times;
                    </button>
                  )}
                  <span className="whitespace-nowrap rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-slate-400">
                    {allBookings.length} total
                  </span>
                </div>
                {bookingsMessage && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{bookingsMessage}</p>}

                {(() => {
                  const query = bookingSearch.trim().toLowerCase()
                  const statusFiltered = bookingStatusFilter === 'all' ? allBookings : allBookings.filter((b) => b.status === bookingStatusFilter)
                  const tripFiltered = bookingTripFilter === 'all' ? statusFiltered : statusFiltered.filter((b) => b.scheduleId === bookingTripFilter)
                  const filtered = !query
                    ? tripFiltered
                    : tripFiltered.filter((b) => {
                        const passengerNames = b.passengers.map((p) => fullName(p)).join(' ').toLowerCase()
                        return (
                          (b.referenceCode || '').toLowerCase().includes(query) ||
                          (b.contactEmail || '').toLowerCase().includes(query) ||
                          (b.contactNumber || '').toLowerCase().includes(query) ||
                          passengerNames.includes(query)
                        )
                      })

                  // Needs-attention statuses first, then soonest trip within
                  // the same tier — mirrors the "attention first" ordering
                  // used for customers and verification requests.
                  const sorted = [...filtered].sort((a, b) => {
                    const pa = bookingStatusPriority[a.status] ?? 6
                    const pb = bookingStatusPriority[b.status] ?? 6
                    if (pa !== pb) return pa - pb
                    const da = a.schedule ? new Date(a.schedule.departureDatetime).getTime() : Infinity
                    const db = b.schedule ? new Date(b.schedule.departureDatetime).getTime() : Infinity
                    return da - db
                  })

                  return allBookings.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No bookings yet.</p>
                  ) : sorted.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">
                      {query ? 'No bookings match that search.' : 'No bookings match this filter.'}
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2.5">
                      {sorted.map((b) => (
                        <div key={b.id} className="rounded-lg border border-gray-200 dark:border-slate-800 p-3.5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-bold tracking-wide text-gray-800 dark:text-slate-100">{b.referenceCode || '-'}</p>
                              {b.customerId ? (
                                <span className="whitespace-nowrap rounded-full bg-teal-100 dark:bg-teal-500/15 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                                  Registered
                                </span>
                              ) : (
                                <span className="whitespace-nowrap rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-400">
                                  Guest
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={b.status} />
                              <span className="font-semibold text-gray-800 dark:text-slate-100">{formatPeso(b.totalFare)}</span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-slate-400 sm:grid-cols-2">
                            <p>
                              <span className="text-gray-400 dark:text-slate-500">Contact:</span> {b.contactEmail}
                              {b.contactNumber ? ` · ${b.contactNumber}` : ''}
                            </p>
                            <p>
                              <span className="text-gray-400 dark:text-slate-500">Trip:</span>{' '}
                              {b.schedule
                                ? `${directionLabel[b.schedule.direction] || b.schedule.direction} · ${new Date(b.schedule.departureDatetime).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}`
                                : '—'}
                            </p>
                            <p className="sm:col-span-2">
                              <span className="text-gray-400 dark:text-slate-500">Passengers:</span>{' '}
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
            <div className="space-y-5">
              <Card title="Refund Requests">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Payments come in through QR codes, so refunds are sent manually — confirm where to send the money
                  before transferring it yourself, then mark the request as resolved here.
                </p>

                <div className="mt-3 grid grid-cols-3 divide-x divide-gray-200 dark:divide-slate-800 rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40">
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-lg font-bold leading-none text-gray-900 dark:text-white">{refundRequests.length}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Pending</p>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-lg font-bold leading-none text-blue-600 dark:text-blue-400">{formatPeso(refundTotalAmount)}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Awaiting Refund</p>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <p className="text-lg font-bold leading-none text-amber-600 dark:text-amber-400">{oldestRefundDays}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Days (Oldest)</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <button onClick={loadRefundRequests} className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
                    Refresh
                  </button>
                </div>
                {refundsMessage && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{refundsMessage}</p>}

                {refundRequests.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No refund requests awaiting review right now.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {refundRequests.map((b) => {
                      const isProcessing = processingRefundId === b.id
                      const waitingDays = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 86400000)
                      const isOpen = expandedRefundId === b.id
                      return (
                        <div key={b.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setExpandedRefundId(isOpen ? null : b.id)}
                            className={`flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left transition-colors sm:p-5 ${
                              isOpen ? 'bg-gray-50 dark:bg-slate-800/40' : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <div>
                              <p className="font-mono text-sm font-bold tracking-wide text-gray-800 dark:text-slate-100">{b.referenceCode}</p>
                              <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-500">
                                {b.contactEmail}{b.contactNumber ? ` · ${b.contactNumber}` : ''}
                              </p>
                              <p className="mt-1 text-xs font-medium text-teal-700 dark:text-teal-300">{isOpen ? 'Hide details' : 'View details'}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <span className="whitespace-nowrap rounded-full bg-blue-100 dark:bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                                {formatPeso(b.totalFare)} to refund
                              </span>
                              <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                                Waiting {waitingDays === 0 ? 'less than a day' : `${waitingDays} day${waitingDays === 1 ? '' : 's'}`}
                              </p>
                            </div>
                          </button>

                          {isOpen && (
                          <div className="border-t border-gray-100 dark:border-slate-800 p-4 sm:p-5">
                          <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-slate-400 sm:grid-cols-2">
                            <p>
                              <span className="text-gray-400 dark:text-slate-500">Departure:</span>{' '}
                              {b.schedule
                                ? `${directionLabel[b.schedule.direction] || b.schedule.direction} · ${new Date(b.schedule.departureDatetime).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}`
                                : '—'}
                            </p>
                            <p>
                              <span className="text-gray-400 dark:text-slate-500">Booked:</span>{' '}
                              {new Date(b.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                            <p className="sm:col-span-2">
                              <span className="text-gray-400 dark:text-slate-500">Passengers:</span>{' '}
                              {b.passengers.map((p) => fullName(p)).join(', ')}
                            </p>
                          </div>

                          <div className="mt-3 rounded-md border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Customer's Reason</p>
                            <p className="mt-1 text-sm text-gray-700 dark:text-slate-300">{b.cancellationReason || '—'}</p>
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
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => setOpenRefundAction((prev) => ({ ...prev, [b.id]: 'approve' }))}
                                      disabled={isProcessing}
                                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-slate-400"
                                    >
                                      Approve &amp; Refund
                                    </button>
                                    <button
                                      onClick={() => setOpenRefundAction((prev) => ({ ...prev, [b.id]: 'reject' }))}
                                      disabled={isProcessing}
                                      className="rounded-md border border-red-200 dark:border-red-500/30 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}

                                {openAction === 'approve' && (
                                  <div className="rounded-md border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-4">
                                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">Approve &amp; Send Refund</p>
                                    <p className="mt-0.5 text-xs text-green-700/80 dark:text-green-400/80">Complete both steps below, then confirm.</p>

                                    <div className="mt-3 space-y-2.5">
                                      <div className="flex gap-3 rounded-md border border-green-200/70 dark:border-green-500/20 bg-white dark:bg-slate-900 p-3">
                                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">1</span>
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Confirm where to send it</p>
                                          <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                                            QR Ph payments don't record which e-wallet or bank the customer paid with, so ask them directly before sending anything.
                                          </p>
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            <a
                                              href={approveMailto}
                                              className="inline-block rounded-md border border-green-300 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/15"
                                            >
                                              Email: {b.contactEmail}
                                            </a>
                                            {b.contactNumber && (
                                              <span className="inline-flex items-center rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300">
                                                Or text: {b.contactNumber}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex gap-3 rounded-md border border-green-200/70 dark:border-green-500/20 bg-white dark:bg-slate-900 p-3">
                                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">2</span>
                                        <p className="text-sm text-gray-700 dark:text-slate-300">
                                          Send <span className="font-semibold text-gray-900 dark:text-white">₱{fareStr}</span> to the account they confirm,
                                          using your own GCash, Maya, or bank transfer app.
                                        </p>
                                      </div>
                                    </div>

                                    <label className="mt-3 flex items-start gap-2 rounded-md border border-green-200 dark:border-green-500/30 bg-white dark:bg-slate-900 p-3 text-sm text-gray-700 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) =>
                                          setRefundConfirmChecked((prev) => ({ ...prev, [b.id]: e.target.checked }))
                                        }
                                        className="mt-0.5 h-4 w-4 accent-green-600"
                                      />
                                      I've sent the ₱{fareStr} refund to the customer's confirmed account.
                                    </label>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        onClick={() => markRefunded(b.id)}
                                        disabled={!checked || isProcessing}
                                        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-slate-400"
                                      >
                                        {isProcessing ? 'Working...' : 'Confirm & Mark as Refunded'}
                                      </button>
                                      <button
                                        onClick={() => closeRefundPanel(b.id)}
                                        disabled={isProcessing}
                                        className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {openAction === 'reject' && (
                                  <div className="rounded-md border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
                                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Reject This Request</p>
                                    <p className="mt-0.5 text-xs text-red-700/80 dark:text-red-400/80">
                                      Rejecting won't notify the customer automatically — let them know yourself first.
                                    </p>

                                    <div className="mt-3 flex gap-3 rounded-md border border-red-200/70 dark:border-red-500/20 bg-white dark:bg-slate-900 p-3">
                                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">1</span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-800 dark:text-slate-100">Let them know</p>
                                        <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                                          Reach out so they're not left wondering why the refund wasn't approved.
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <a
                                            href={rejectMailto}
                                            className="inline-block rounded-md border border-red-300 dark:border-red-500/40 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/15"
                                          >
                                            Email {b.contactEmail}
                                          </a>
                                          {b.contactNumber && (
                                            <span className="inline-flex items-center rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-300">
                                              Also text: {b.contactNumber}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <label className="mt-3 flex items-start gap-2 rounded-md border border-red-200 dark:border-red-500/30 bg-white dark:bg-slate-900 p-3 text-sm text-gray-700 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) =>
                                          setRefundConfirmChecked((prev) => ({ ...prev, [b.id]: e.target.checked }))
                                        }
                                        className="mt-0.5 h-4 w-4 accent-red-600"
                                      />
                                      I've emailed and texted the customer about this decision.
                                    </label>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        onClick={() => rejectRefund(b.id)}
                                        disabled={!checked || isProcessing}
                                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-slate-400"
                                      >
                                        {isProcessing ? 'Working...' : 'Confirm Rejection'}
                                      </button>
                                      <button
                                        onClick={() => closeRefundPanel(b.id)}
                                        disabled={isProcessing}
                                        className="rounded-md px-4 py-2 text-sm font-medium text-gray-500 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800"
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
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'manifest' && (
            <div className="space-y-5">
              <Card title="Passenger Manifest">
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Pick a sailing to pull its full passenger list — useful for boarding checks or handing to the
                    ferry crew.
                  </p>
                  <label className="mt-3 block text-sm font-medium text-gray-600 dark:text-slate-400">Schedule</label>
                  <select
                    value={manifestScheduleId}
                    onChange={(e) => setManifestScheduleId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Select a schedule</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.departureDatetime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {' · '}
                        {directionLabel[s.direction] || s.direction}
                        {s.ferry ? ` · ${s.ferry.name}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={loadManifest} className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800">
                      Generate Manifest
                    </button>
                    <button
                      onClick={() => window.open(`/admin/manifest-print?scheduleId=${manifestScheduleId}`, '_blank')}
                      disabled={manifestPassengers.length === 0}
                      className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Print
                    </button>
                  </div>
                  {manifestMessage && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{manifestMessage}</p>}
                </div>

                {(() => {
                  const selectedSchedule = schedules.find((sc) => sc.id === manifestScheduleId)
                  if (!selectedSchedule) return null

                  return (
                    <div className="mt-3 grid grid-cols-2 divide-x divide-gray-200 dark:divide-slate-800 rounded-md border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 sm:grid-cols-3">
                      <div className="px-3 py-2.5 text-center">
                        <p className="text-lg font-bold leading-none text-gray-900 dark:text-white">{manifestPassengers.length}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Passengers</p>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <p className="text-lg font-bold leading-none text-teal-600 dark:text-teal-400">
                          {selectedSchedule.ferry ? selectedSchedule.ferry.seatCapacity : '—'}
                        </p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Seat Capacity</p>
                      </div>
                      <div className="px-3 py-2.5 text-center">
                        <p className="text-lg font-bold leading-none text-amber-600 dark:text-amber-400">
                          {selectedSchedule.ferry ? Math.max(selectedSchedule.ferry.seatCapacity - manifestPassengers.length, 0) : '—'}
                        </p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">Seats Left</p>
                      </div>
                    </div>
                  )
                })()}

                {!manifestScheduleId ? (
                  <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">Select a schedule above and generate its manifest.</p>
                ) : manifestPassengers.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No passengers booked for this sailing yet.</p>
                ) : (
                  <DataTable headers={['Name', 'Sex', 'Nationality', 'Address', 'Email', 'Contact']}>
                    {manifestPassengers.map((p, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-slate-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/30">
                        <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-slate-100">{fullName(p)}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{p.sex || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{p.nationality || '—'}</td>
                        <td className="px-3 py-1.5 max-w-[260px] text-gray-600 dark:text-slate-400">{fullAddress(p) || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{p.email || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{p.contactNumber || '—'}</td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Based on confirmed bookings only — pending, declined, and cancelled bookings aren't counted toward revenue.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Revenue"
                  value={formatPeso(totalRevenue)}
                  accent="teal"
                  hint={analyticsRangeLabel}
                  active={expandedStat === 'revenue'}
                  onClick={() => setExpandedStat(expandedStat === 'revenue' ? null : 'revenue')}
                />
                <StatCard
                  label="Total Bookings"
                  value={totalBookingsInRange}
                  accent="blue"
                  hint={analyticsRangeLabel}
                  active={expandedStat === 'bookings'}
                  onClick={() => setExpandedStat(expandedStat === 'bookings' ? null : 'bookings')}
                />
                <StatCard
                  label="Avg. Monthly Revenue"
                  value={formatPeso(avgMonthlyRevenue)}
                  accent="purple"
                  hint={`${filteredAnalytics.length} month${filteredAnalytics.length === 1 ? '' : 's'} with sales`}
                  active={expandedStat === 'avg'}
                  onClick={() => setExpandedStat(expandedStat === 'avg' ? null : 'avg')}
                />
                <StatCard
                  label="Best Month"
                  value={bestMonth ? formatMonthLabel(bestMonth.month) : '—'}
                  accent="amber"
                  hint={bestMonth ? formatPeso(bestMonth.revenue) : undefined}
                  active={expandedStat === 'best'}
                  onClick={() => setExpandedStat(expandedStat === 'best' ? null : 'best')}
                />
              </div>

              {expandedStat && (
                <Card className="bg-teal-50 dark:bg-teal-900/20">
                  {expandedStat === 'revenue' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <b>{formatPeso(totalRevenue)}</b> in confirmed booking fares across <b>{analyticsRangeLabel}</b>
                      {filteredAnalytics.length > 0 && (
                        <> — spread over {filteredAnalytics.length} month{filteredAnalytics.length === 1 ? '' : 's'} with sales.</>
                      )}
                    </p>
                  )}
                  {expandedStat === 'bookings' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <b>{totalBookingsInRange}</b> confirmed booking{totalBookingsInRange === 1 ? '' : 's'} in {analyticsRangeLabel}
                      {filteredAnalytics.length > 0 && (
                        <> — about {(totalBookingsInRange / filteredAnalytics.length).toFixed(1)} per month on average.</>
                      )}
                    </p>
                  )}
                  {expandedStat === 'avg' && (
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      {formatPeso(totalRevenue)} total &divide; {filteredAnalytics.length} month{filteredAnalytics.length === 1 ? '' : 's'} with sales ={' '}
                      <b>{formatPeso(avgMonthlyRevenue)}</b> average per month, for {analyticsRangeLabel}.
                    </p>
                  )}
                  {expandedStat === 'best' && (
                    bestMonth ? (
                      <p className="text-sm text-gray-700 dark:text-slate-300">
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
                      <p className="text-sm text-gray-700 dark:text-slate-300">No confirmed bookings in this range yet.</p>
                    )
                  )}
                </Card>
              )}

              <Card title="Monthly Sales">
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Revenue and booking volume by month. Narrow the range below to compare specific periods, or leave
                  it blank to see everything on record.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-500">From</label>
                    <input
                      type="month"
                      value={analyticsFrom}
                      onChange={(e) => setAnalyticsFrom(e.target.value)}
                      className="mt-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-500">To</label>
                    <input
                      type="month"
                      value={analyticsTo}
                      onChange={(e) => setAnalyticsTo(e.target.value)}
                      className="mt-1 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  {(analyticsFrom || analyticsTo) && (
                    <button
                      onClick={() => { setAnalyticsFrom(''); setAnalyticsTo('') }}
                      className="rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      Clear range
                    </button>
                  )}
                  <button
                    onClick={loadAnalytics}
                    className="ml-auto rounded-md bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800"
                  >
                    Refresh
                  </button>
                </div>
                {analyticsMessage && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{analyticsMessage}</p>}

                <div className="mt-5">
                  <RevenueBarChart data={filteredAnalytics} />
                </div>

                {filteredAnalytics.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500 dark:text-slate-500">No sales data for this range yet.</p>
                ) : (
                  <DataTable headers={['Month', 'Revenue', 'Bookings', 'Change']}>
                    {[...analyticsWithChange].reverse().map((m) => (
                      <tr key={m.month} className="border-t border-gray-100 dark:border-slate-800 hover:bg-teal-50/50 dark:hover:bg-teal-900/30">
                        <td className="px-3 py-1.5 font-medium text-gray-800 dark:text-slate-100">{formatMonthLabel(m.month)}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{formatPeso(m.revenue)}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-slate-300">{m.count}</td>
                        <td className="px-3 py-1.5">
                          {m.change === null ? (
                            <span className="text-gray-400 dark:text-slate-500">—</span>
                          ) : (
                            <span className={m.change >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                              {m.change >= 0 ? '▲' : '▼'} {Math.abs(m.change).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                )}
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
