import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import BookingSteps from '../components/BookingSteps.jsx'

function emptyPassenger() {
  return {
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    sex: 'Male',
    nationality: 'Filipino',
    barangay: '',
    city_municipality: '',
    province: '',
    zip_code: '',
    country: 'Philippines',
    email: '',
    contact_number: '',
    discount_type: 'none',
  }
}

function passengerFullName(p) {
  return [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(' ')
}

// Tracks which region/province/city a passenger's address dropdowns
// currently have selected. Kept separate from the passenger object itself
// (which only stores plain name strings, matching what the backend expects)
// so the selects stay controlled without smuggling extra fields into the
// booking payload.
function emptyAddressCodes() {
  return { regionCode: '', provinceCode: '', cityCode: '', isCity: false, foreign: false }
}

// Philippine Standard Geographic Code (PSGC) reference API — a free, public
// service maintained off our infrastructure. Used to power cascading
// Region -> Province -> City/Municipality -> Barangay dropdowns so
// passengers pick their address from an accurate official list instead of
// free-typing it (and risking typos or a misspelled barangay).
const PSGC_API = 'https://psgc.gitlab.io/api'

// A typeable dropdown: shows the selected option's label, but focusing it
// clears the box so the passenger can type to filter instead of scrolling
// through a long list (provinces, cities, and barangays can each run into
// the hundreds). Selecting an option or clicking away closes the list.
function SearchableSelect({ value, options, onChange, placeholder, disabled, disabledPlaceholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        disabled={disabled}
        value={open ? query : selected ? selected.label : ''}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setQuery('')
          setOpen(true)
        }}
        placeholder={disabled ? disabledPlaceholder || placeholder : placeholder}
        autoComplete="off"
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
      />
      {open && !disabled && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-md">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No matches</p>
          ) : (
            filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                  setQuery('')
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                  o.value === value ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-700'
                }`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// A red asterisk marking a required field's label — kept as one component so
// every required field renders the exact same mark instead of copy-pasted
// spans drifting out of sync with each other.
function Required() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {' '}*
    </span>
  )
}

const directionLabel = {
  PB_TO_LIMASAWA: 'Padre Burgos → Limasawa',
  LIMASAWA_TO_PB: 'Limasawa → Padre Burgos',
}

export default function Booking() {
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get('schedule_id')
  const fare = searchParams.get('fare')
  const datetime = searchParams.get('datetime')
  const direction = searchParams.get('direction') === 'LIMASAWA_TO_PB' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'
  // Set by the admin per schedule (Admin dashboard > Add Schedule), carried
  // through the URL the same way `fare` already is. Falls back to 20% if
  // missing (e.g. an old bookmarked link from before this existed) so the
  // preview never breaks. Display only, the server always recalculates the
  // real charge from the schedule row itself at booking time.
  const seniorDiscountPercent = Number(searchParams.get('senior_discount') ?? 20)
  const pwdDiscountPercent = Number(searchParams.get('pwd_discount') ?? 20)
  const studentDiscountPercent = Number(searchParams.get('student_discount') ?? 20)

  const navigate = useNavigate()
  const location = useLocation()
  // Guest email verification happens on its own dedicated page (see
  // GuestVerifyEmail.jsx) rather than inline here, so the in-progress
  // passenger details need to survive that round trip. They're carried via
  // router state — passed forward when navigating to the verify page, and
  // handed back (plus the verification result) when it returns here.
  const restored = location.state || {}

  const { customer } = useAuth()
  // Only a logged-in, admin-verified profile can use its discount type.
  const canUseDiscount = customer?.discountStatus === 'verified'

  // 'form' -> filling out passenger details, 'review' -> read-only summary
  // before the booking is actually created.
  const [phase, setPhase] = useState('form')

  const [passengers, setPassengers] = useState(() => restored.passengers || [emptyPassenger()])
  const [addressCodes, setAddressCodes] = useState(() => restored.addressCodes || [emptyAddressCodes()])
  const [passengerCountInput, setPassengerCountInput] = useState(() =>
    String((restored.passengers || [emptyPassenger()]).length)
  )
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Region list is the same for every passenger, so it's fetched once and
  // shared. Province/city/barangay lists are fetched on demand and cached by
  // code, so switching passengers or re-selecting the same area doesn't
  // re-fetch. A handful of regions (NCR chief among them) have no provinces
  // at all — their cities sit directly under the region — so provincesCache
  // records an empty, successfully-loaded list for those rather than an error.
  const [regions, setRegions] = useState([])
  const [regionsError, setRegionsError] = useState(false)
  const [provincesCache, setProvincesCache] = useState({}) // regionCode -> { list, loading, error }
  const [citiesCache, setCitiesCache] = useState({}) // provinceCode or "region:<code>" -> { list, loading, error }
  const [barangaysCache, setBarangaysCache] = useState({}) // cityOrMunicipalityCode -> { list, loading, error }

  useEffect(() => {
    let cancelled = false
    fetch(`${PSGC_API}/regions/`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load regions')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const list = data
          .map((r) => ({ code: r.code, name: r.regionName && r.regionName !== r.name ? `${r.name} (${r.regionName})` : r.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setRegions(list)
      })
      .catch(() => {
        if (!cancelled) setRegionsError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function loadProvinces(regionCode) {
    if (!regionCode || provincesCache[regionCode]) return
    setProvincesCache((prev) => ({ ...prev, [regionCode]: { list: [], loading: true, error: false } }))
    fetch(`${PSGC_API}/regions/${regionCode}/provinces/`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load provinces')
        return res.json()
      })
      .then((data) => {
        const list = data
          .map((p) => ({ code: p.code, name: p.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setProvincesCache((prev) => ({ ...prev, [regionCode]: { list, loading: false, error: false } }))
        // No provinces under this region (e.g. NCR) — its cities are listed
        // directly under the region instead, so load those right away.
        if (list.length === 0) loadCitiesForRegion(regionCode)
      })
      .catch(() => {
        setProvincesCache((prev) => ({ ...prev, [regionCode]: { list: [], loading: false, error: true } }))
      })
  }

  function loadCitiesForRegion(regionCode) {
    const key = `region:${regionCode}`
    if (citiesCache[key]) return
    setCitiesCache((prev) => ({ ...prev, [key]: { list: [], loading: true, error: false } }))
    fetch(`${PSGC_API}/regions/${regionCode}/cities-municipalities/`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load cities')
        return res.json()
      })
      .then((data) => {
        const list = data
          .map((c) => ({ code: c.code, name: c.name, isCity: Boolean(c.isCity) }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setCitiesCache((prev) => ({ ...prev, [key]: { list, loading: false, error: false } }))
      })
      .catch(() => {
        setCitiesCache((prev) => ({ ...prev, [key]: { list: [], loading: false, error: true } }))
      })
  }

  function loadCitiesForProvince(provinceCode) {
    if (!provinceCode || citiesCache[provinceCode]) return
    setCitiesCache((prev) => ({ ...prev, [provinceCode]: { list: [], loading: true, error: false } }))
    fetch(`${PSGC_API}/provinces/${provinceCode}/cities-municipalities/`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load cities')
        return res.json()
      })
      .then((data) => {
        const list = data
          .map((c) => ({ code: c.code, name: c.name, isCity: Boolean(c.isCity) }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setCitiesCache((prev) => ({ ...prev, [provinceCode]: { list, loading: false, error: false } }))
      })
      .catch(() => {
        setCitiesCache((prev) => ({ ...prev, [provinceCode]: { list: [], loading: false, error: true } }))
      })
  }

  function loadBarangays(areaCode, isCity) {
    if (!areaCode || barangaysCache[areaCode]) return
    setBarangaysCache((prev) => ({ ...prev, [areaCode]: { list: [], loading: true, error: false } }))
    const kind = isCity ? 'cities' : 'municipalities'
    fetch(`${PSGC_API}/${kind}/${areaCode}/barangays/`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load barangays')
        return res.json()
      })
      .then((data) => {
        const list = data
          .map((b) => ({ code: b.code, name: b.name }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setBarangaysCache((prev) => ({ ...prev, [areaCode]: { list, loading: false, error: false } }))
      })
      .catch(() => {
        setBarangaysCache((prev) => ({ ...prev, [areaCode]: { list: [], loading: false, error: true } }))
      })
  }

  function handleRegionSelect(index, regionCode) {
    // Region is only a narrower for the Province/City dropdowns below — the
    // backend doesn't store it (an address is just barangay/city/province),
    // so it's tracked in addressCodes only, never written onto the
    // passenger object that gets submitted.
    setAddressCodes((prev) => {
      const next = [...prev]
      next[index] = { regionCode, provinceCode: '', cityCode: '', isCity: false }
      return next
    })
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, province: '', city_municipality: '', barangay: '' } : p))
    )
    if (regionCode) loadProvinces(regionCode)
  }

  function handleProvinceSelect(index, provinceCode) {
    const regionCode = addressCodes[index]?.regionCode
    const province = (provincesCache[regionCode]?.list || []).find((p) => p.code === provinceCode)
    setAddressCodes((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], provinceCode, cityCode: '', isCity: false }
      return next
    })
    setPassengers((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, province: province ? province.name : '', city_municipality: '', barangay: '' } : p
      )
    )
    if (provinceCode) loadCitiesForProvince(provinceCode)
  }

  // A region either has provinces (pick one, then its cities) or doesn't
  // (NCR-style — cities sit directly under the region). This resolves which
  // cache key currently applies for a given passenger's selections.
  function citiesKeyFor(codes) {
    if (!codes) return ''
    if (codes.provinceCode) return codes.provinceCode
    const provinceData = provincesCache[codes.regionCode]
    const noProvince = provinceData && !provinceData.loading && !provinceData.error && provinceData.list.length === 0
    return noProvince ? `region:${codes.regionCode}` : ''
  }

  function handleCitySelect(index, cityCode) {
    const citiesKey = citiesKeyFor(addressCodes[index])
    const city = (citiesCache[citiesKey]?.list || []).find((c) => c.code === cityCode)
    setAddressCodes((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], cityCode, isCity: city ? city.isCity : false }
      return next
    })
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, city_municipality: city ? city.name : '', barangay: '' } : p))
    )
    if (city) loadBarangays(cityCode, city.isCity)
  }

  // The PSGC dropdowns only cover Philippine addresses, and this route also
  // sells to foreign tourists — this switches a passenger's address section
  // over to plain free-text fields (including an editable Country) instead
  // of forcing them into a Philippine barangay/city/province that doesn't
  // apply to them.
  function handleToggleForeignAddress(index, checked) {
    setAddressCodes((prev) => {
      const next = [...prev]
      next[index] = { ...emptyAddressCodes(), foreign: checked }
      return next
    })
    setPassengers((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              barangay: '',
              city_municipality: '',
              province: '',
              zip_code: '',
              country: checked ? '' : 'Philippines',
            }
          : p
      )
    )
  }

  // A logged-in account works immediately even before its email is
  // verified, but completing a booking under that account requires it —
  // enforced server-side; this just lets the customer resend the link
  // without leaving the booking flow.
  const [resendStatus, setResendStatus] = useState('idle') // idle | sending | sent | error
  const [resendMessage, setResendMessage] = useState('')
  async function handleResendVerification() {
    setResendStatus('sending')
    setResendMessage('')
    try {
      const data = await api.resendVerification()
      setResendStatus('sent')
      setResendMessage(data.message || 'Verification email sent — check your inbox.')
    } catch (err) {
      setResendStatus('error')
      setResendMessage(err.message)
    }
  }

  // Logged-in customers get Passenger 1 pre-filled from their account by
  // default (since most bookings are for the account holder), but a booking
  // is often made on someone else's behalf — a parent booking for their
  // child, a friend booking a group trip, etc. This toggle lets them switch
  // Passenger 1 back to a blank, freely-editable form for that case.
  const [bookingForSelf, setBookingForSelf] = useState(true)

  function fillPassengerOneFromAccount() {
    if (!customer) return
    const nameParts = customer.name.trim().split(/\s+/).filter(Boolean)
    const first_name = nameParts[0] || ''
    const last_name = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''
    const middle_name = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : ''
    setPassengers((prev) => {
      const next = [...prev]
      next[0] = {
        ...next[0],
        first_name,
        middle_name,
        last_name,
        barangay: customer.barangay || '',
        city_municipality: customer.cityMunicipality || '',
        province: customer.province || '',
        zip_code: customer.zipCode || '',
        country: 'Philippines',
        email: customer.email || '',
        contact_number: customer.contactNumber || '',
        discount_type: canUseDiscount ? customer.discountType : 'none',
      }
      return next
    })
    // The account's saved address is plain text, not a province/city code —
    // the dropdown starts fresh if they later uncheck "Booking for myself".
    setAddressCodes((prev) => {
      const next = [...prev]
      next[0] = emptyAddressCodes()
      return next
    })
  }

  function handleBookingForSelfToggle(checked) {
    setBookingForSelf(checked)
    if (checked) {
      fillPassengerOneFromAccount()
    } else {
      // Switching to "someone else" — clear the account-derived fields so
      // there's no leftover data from the account holder on the new
      // passenger's ticket. Sex/Nationality aren't account fields, so leave
      // whatever was already entered there untouched.
      setPassengers((prev) => {
        const next = [...prev]
        next[0] = {
          ...next[0],
          first_name: '', middle_name: '', last_name: '',
          barangay: '', city_municipality: '', province: '', zip_code: '', country: 'Philippines',
          email: '', contact_number: '', discount_type: 'none',
        }
        return next
      })
      setAddressCodes((prev) => {
        const next = [...prev]
        next[0] = emptyAddressCodes()
        return next
      })
    }
  }

  // Auto-fill Passenger 1 as soon as we know who's logged in.
  useEffect(() => {
    if (customer && bookingForSelf) fillPassengerOneFromAccount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  // Passenger 1's identity/contact/address fields are locked while booking
  // for the account holder — they come straight from the verified account,
  // so there's nothing to edit. Unchecking "Booking for myself" unlocks them.
  const lockPassengerOneFields = Boolean(customer) && bookingForSelf

  const [booking, setBooking] = useState(null)

  const [qrCodeImageUrl, setQrCodeImageUrl] = useState(null)
  const [testUrl, setTestUrl] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('idle') // idle | loading | awaiting_payment | paid | expired | error
  const [paymentError, setPaymentError] = useState('')

  // No separate "Contact Details" step — the contact email/number used for
  // booking lookups, receipts, and payment polling comes from the
  // logged-in customer's account, or from Passenger 1's fields for guests.
  const contactEmail = customer ? customer.email : passengers[0]?.email || ''
  const contactNumber = customer ? customer.contactNumber || '' : passengers[0]?.contact_number || ''

  // Guest checkout has no account, so there's nothing like
  // customer.emailVerified to check — verification instead happens on a
  // separate dedicated page (GuestVerifyEmail.jsx), which sends Passenger
  // 1's email a one-time code and, once confirmed, hands back a short-lived
  // guestVerificationToken (tied to that exact email) sent along with the
  // booking request. Restored from router state if we're returning here
  // after a successful verification.
  const [guestVerifiedEmail, setGuestVerifiedEmail] = useState(restored.guestVerifiedEmail || '')
  const [guestVerificationToken, setGuestVerificationToken] = useState(restored.guestVerificationToken || '')

  // If they edit the email after verifying, the old token was only ever
  // proof of the previous address — drop back to unverified rather than
  // letting a stale verification silently cover a different inbox.
  useEffect(() => {
    if (guestVerifiedEmail && guestVerifiedEmail.toLowerCase() !== contactEmail.trim().toLowerCase()) {
      setGuestVerifiedEmail('')
      setGuestVerificationToken('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactEmail])

  // Sends the passenger along to the dedicated verification page, carrying
  // everything they've filled in so far — the return trip hands it right
  // back (plus the verification result) rather than losing their progress.
  function handleGoToGuestVerification() {
    const email = contactEmail.trim()
    if (!email) {
      setError("Enter Passenger 1's email above first.")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address before verifying.')
      return
    }
    setError('')
    navigate('/booking/verify-guest-email', {
      state: { email, passengers, addressCodes, returnSearch: location.search },
    })
  }

  const emailNeedsVerification = customer
    ? !customer.emailVerified
    : !(guestVerifiedEmail && guestVerifiedEmail.toLowerCase() === contactEmail.trim().toLowerCase())

  let currentStep = 'passenger'
  if (booking) {
    currentStep = paymentStatus === 'paid' ? 'confirmation' : 'payment'
  } else if (phase === 'review') {
    currentStep = 'review'
  }

  function updatePassengerCount(count) {
    const num = Math.max(1, Math.min(10, count))
    setPassengers((prev) => {
      const next = [...prev]
      while (next.length < num) next.push(emptyPassenger())
      next.length = num
      return next
    })
    setAddressCodes((prev) => {
      const next = [...prev]
      while (next.length < num) next.push(emptyAddressCodes())
      next.length = num
      return next
    })
  }

  function handlePassengerCountChange(e) {
    const raw = e.target.value
    setPassengerCountInput(raw)
    const num = parseInt(raw, 10)
    if (!isNaN(num) && num >= 1 && num <= 10) {
      updatePassengerCount(num)
    }
  }

  function handlePassengerCountBlur() {
    const num = parseInt(passengerCountInput, 10)
    const clamped = Math.max(1, Math.min(10, isNaN(num) ? 1 : num))
    updatePassengerCount(clamped)
    setPassengerCountInput(String(clamped))
  }

  function updatePassenger(index, field, value) {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    )
  }

  // Philippine ZIP codes are 4 digits — strip anything non-numeric as it's
  // typed rather than validating after the fact, so a passenger never sees
  // an error for a stray letter that a phone keyboard autocorrected in.
  // Foreign postal codes vary in format (letters and numbers both, e.g. UK
  // postcodes), so that restriction only applies to Philippine addresses.
  function handleZipCodeChange(index, raw, foreign) {
    if (foreign) {
      updatePassenger(index, 'zip_code', raw.slice(0, 12))
      return
    }
    updatePassenger(index, 'zip_code', raw.replace(/\D/g, '').slice(0, 4))
  }

  // Philippine mobile numbers are 11 digits starting with "09". Rejecting
  // keystrokes that break that prefix (instead of just capping length) means
  // the field can never end up holding something that isn't a valid mobile
  // number shape.
  // The strict "09" mobile format only makes sense for a Philippine number —
  // a foreign traveler's own phone won't fit that shape, so their field just
  // strips characters that can't appear in a phone number instead of forcing
  // the local pattern.
  function handleContactNumberChange(index, raw, foreign) {
    if (foreign) {
      updatePassenger(index, 'contact_number', raw.replace(/[^\d+\-() ]/g, '').slice(0, 20))
      return
    }
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    const validSoFar = digits.length === 0 || (digits[0] === '0' && (digits.length === 1 || digits[1] === '9'))
    if (validSoFar) updatePassenger(index, 'contact_number', digits)
  }

  function estimateFare(p) {
    const base = Number(fare)
    const percentByType = {
      senior: seniorDiscountPercent,
      pwd: pwdDiscountPercent,
      student: studentDiscountPercent,
    }
    const percent = percentByType[p.discount_type]
    return percent != null ? base * (1 - percent / 100) : base
  }
  const estimatedTotal = passengers.reduce((sum, p) => sum + estimateFare(p), 0)

  function goToReview() {
    setError('')
    if (emailNeedsVerification) {
      setError('Please verify your email before booking — see above.')
      return
    }
    if (!contactEmail || passengers.some((p) => !p.first_name || !p.last_name)) {
      setError(
        customer
          ? "Please fill in every passenger's first and last name."
          : "Please fill in Passenger 1's email and every passenger's first and last name."
      )
      return
    }
    // Locked Passenger 1 fields come straight from the account and were
    // already valid when saved there — only check fields the passenger
    // actually typed into just now.
    const editableIndexes = passengers.map((_, i) => i).filter((i) => !(i === 0 && lockPassengerOneFields))
    // The 4-digit format only applies to Philippine addresses — foreign
    // postal codes are free-form and aren't checked here.
    if (
      editableIndexes.some((i) => {
        const codes = addressCodes[i] || emptyAddressCodes()
        return !codes.foreign && passengers[i].zip_code && passengers[i].zip_code.length !== 4
      })
    ) {
      setError('Zip Code must be exactly 4 digits.')
      return
    }
    if (
      editableIndexes.some((i) => {
        const codes = addressCodes[i] || emptyAddressCodes()
        return codes.foreign && !passengers[i].country.trim()
      })
    ) {
      setError("Please fill in each foreign passenger's country.")
      return
    }
    if (
      editableIndexes.some((i) => {
        const codes = addressCodes[i] || emptyAddressCodes()
        return !codes.foreign && passengers[i].contact_number && passengers[i].contact_number.length !== 11
      })
    ) {
      setError('Contact Number must be 11 digits starting with 09 (e.g. 09171234567).')
      return
    }
    setPhase('review')
  }

  // Coming back from the guest verification page shouldn't dump the
  // passenger back on the form they just finished — jump straight to Review
  // instead, the same as if they'd clicked "Review Booking" themselves.
  useEffect(() => {
    if (restored.autoAdvance) {
      goToReview()
      // Scrub the one-time flag from history so refreshing this page (or
      // clicking "Edit" back to the form) doesn't keep bouncing back here.
      const { autoAdvance, ...rest } = restored
      navigate(`${location.pathname}${location.search}`, { replace: true, state: rest })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitBooking() {
    setError('')
    setSubmitting(true)
    try {
      const payload = {
        schedule_id: scheduleId,
        contact_email: contactEmail,
        contact_number: contactNumber,
        passengers,
        // Only guests need this — a logged-in customer's verification is
        // checked server-side from their account instead.
        ...(customer ? {} : { guest_verification_token: guestVerificationToken }),
      }
      const data = await api.createBooking(payload)
      setBooking(data.booking)
    } catch (err) {
      setError(err.message)
      setPhase('form') // something went wrong — let them fix it, not stare at a dead review screen
    } finally {
      setSubmitting(false)
    }
  }

  async function startPayment() {
    setPaymentStatus('loading')
    setPaymentError('')
    try {
      const data = await api.generatePayment(booking.referenceCode, contactEmail)
      setQrCodeImageUrl(data.qrCodeImageUrl)
      setTestUrl(data.testUrl || null)
      setPaymentStatus('awaiting_payment')
    } catch (err) {
      setPaymentStatus('error')
      setPaymentError(err.message)
    }
  }

  // Kick off QR generation as soon as a booking exists.
  useEffect(() => {
    if (booking) startPayment()
  }, [booking])

  // Poll for payment confirmation while a QR is showing.
  useEffect(() => {
    if (paymentStatus !== 'awaiting_payment') return
    const interval = setInterval(async () => {
      try {
        const data = await api.getPaymentStatus(booking.referenceCode, contactEmail)
        if (data.status === 'paid') setPaymentStatus('paid')
        if (data.status === 'expired') setPaymentStatus('expired')
      } catch {
        // transient network hiccup — keep polling
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [paymentStatus, booking, contactEmail])

  if (!scheduleId) {
    return <p className="text-red-600">No trip selected. Go back and search again.</p>
  }

  return (
    <div className={booking ? undefined : 'sm:pb-24'}>
      <BookingSteps currentStep={currentStep} />

      <h1 className="text-2xl font-bold text-gray-800">Book Your Trip</h1>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Trip Summary</p>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">Route</p>
            <p className="mt-0.5 font-semibold text-gray-800">{directionLabel[direction]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Departure</p>
            <p className="mt-0.5 font-semibold text-gray-800">{new Date(datetime).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Base Fare (per passenger)</p>
            <p className="mt-0.5 font-semibold text-teal-700">{formatPeso(fare)}</p>
          </div>
        </div>
      </div>

      {!booking && phase === 'form' && (
        <>
          {customer && emailNeedsVerification && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p>
                Please verify your email before booking under this account — check <b>{customer.email}</b> for the
                verification link we sent when you registered.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendStatus === 'sending'}
                className="mt-2 font-medium underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendStatus === 'sending' ? 'Sending...' : 'Resend verification email'}
              </button>
              {resendMessage && (
                <p className={`mt-1.5 ${resendStatus === 'error' ? 'text-red-600' : 'text-amber-800'}`}>{resendMessage}</p>
              )}
            </div>
          )}

          {!canUseDiscount && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {customer ? (
                <>
                  Your account isn't verified for a discount yet.{' '}
                  <Link to="/account" className="font-medium underline">
                    Submit your ID on your account page
                  </Link>{' '}
                  to unlock Senior/PWD/Student pricing.
                </>
              ) : (
                <>
                  Discounts (Senior/PWD/Student) are only available to logged-in, verified accounts.{' '}
                  <Link to="/account/login" className="font-medium underline">Log in</Link>{' '}
                  or{' '}
                  <Link to="/register" className="font-medium underline">register</Link>{' '}
                  if you're eligible.
                </>
              )}
            </div>
          )}

          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">Passengers</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter each passenger's details exactly as shown on a valid ID. This is needed for boarding.
              Fields marked with <span className="text-red-600">*</span> are required.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">Number of Passengers</label>
            <input
              type="number"
              min="1"
              max="10"
              value={passengerCountInput}
              onChange={handlePassengerCountChange}
              onBlur={handlePassengerCountBlur}
              onFocus={(e) => e.target.select()}
              className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">Up to 10 passengers per booking.</p>

            {passengers.map((p, i) => (
              <div key={i} className="mt-5 border-t border-gray-100 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-700">
                    Passenger {i + 1}
                    {i === 0 && !customer && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        (booking contact — enter your email &amp; number below)
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">{formatPeso(estimateFare(p))}</span>
                    {i === 0 && customer && (
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={bookingForSelf}
                          onChange={(e) => handleBookingForSelfToggle(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-teal-700 focus:ring-teal-600"
                        />
                        Booking for myself
                      </label>
                    )}
                  </div>
                </div>
                {i === 0 && customer && !bookingForSelf && (
                  <p className="mt-1 text-xs text-gray-500">
                    Enter this passenger's own details below — they won't be saved to your account.
                  </p>
                )}

                <h4 className="mt-4 text-sm font-semibold text-gray-700">Personal Info</h4>
                {!(i === 0 && lockPassengerOneFields) && (
                  <p className="mt-1 text-xs text-gray-500">Spell each name exactly as it appears on a valid, government-issued ID.</p>
                )}
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-gray-600">First Name<Required /></label>
                    <input type="text" placeholder="e.g. Juan" value={p.first_name}
                      disabled={i === 0 && lockPassengerOneFields}
                      onChange={(e) => updatePassenger(i, 'first_name', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Middle Name (optional)</label>
                    <input type="text" placeholder="e.g. Santos" value={p.middle_name}
                      disabled={i === 0 && lockPassengerOneFields}
                      onChange={(e) => updatePassenger(i, 'middle_name', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Last Name<Required /></label>
                    <input type="text" placeholder="e.g. Dela Cruz" value={p.last_name}
                      disabled={i === 0 && lockPassengerOneFields}
                      onChange={(e) => updatePassenger(i, 'last_name', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Suffix (optional)</label>
                    <input type="text" placeholder="Jr., Sr., III" value={p.suffix}
                      onChange={(e) => updatePassenger(i, 'suffix', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Sex<Required /></label>
                    <select value={p.sex} onChange={(e) => updatePassenger(i, 'sex', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Nationality<Required /></label>
                    <input type="text" placeholder="e.g. Filipino" value={p.nationality}
                      onChange={(e) => updatePassenger(i, 'nationality', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                </div>

                <h4 className="mt-4 text-sm font-semibold text-gray-700">Address</h4>
                {!(i === 0 && lockPassengerOneFields) && (
                  <>
                    <p className="mt-1 text-xs text-gray-600">Where does this passenger live?</p>
                    <div className="mt-1.5 inline-flex rounded-md border border-gray-300 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleForeignAddress(i, false)}
                        className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                          !(addressCodes[i] || emptyAddressCodes()).foreign
                            ? 'bg-teal-700 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Philippines
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleForeignAddress(i, true)}
                        className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                          (addressCodes[i] || emptyAddressCodes()).foreign
                            ? 'bg-teal-700 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Outside the Philippines
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {(addressCodes[i] || emptyAddressCodes()).foreign
                        ? "Enter the address as it appears on this passenger's ID or travel documents."
                        : 'Type to search, or browse the list. Region narrows Province, Province narrows City/Municipality, and so on.'}
                    </p>
                  </>
                )}
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(() => {
                    const codes = addressCodes[i] || emptyAddressCodes()
                    const locked = i === 0 && lockPassengerOneFields

                    // The Region/Province/City/Barangay cascade only covers
                    // Philippine addresses — foreign passengers get plain
                    // free-text fields instead.
                    if (!locked && codes.foreign) {
                      return (
                        <>
                          <div>
                            <label className="block text-sm text-gray-600">Street Address<Required /></label>
                            <input type="text" placeholder="e.g. 221B Baker Street" value={p.barangay}
                              onChange={(e) => updatePassenger(i, 'barangay', e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600">City<Required /></label>
                            <input type="text" placeholder="e.g. London" value={p.city_municipality}
                              onChange={(e) => updatePassenger(i, 'city_municipality', e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600">State / Province / Region<Required /></label>
                            <input type="text" placeholder="e.g. Greater London" value={p.province}
                              onChange={(e) => updatePassenger(i, 'province', e.target.value)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600">Postal Code<Required /></label>
                            <input type="text" placeholder="e.g. SW1A 1AA" value={p.zip_code}
                              onChange={(e) => handleZipCodeChange(i, e.target.value, true)}
                              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                          </div>
                        </>
                      )
                    }

                    // If even the region list failed to load, the whole
                    // cascade has nothing to build on — fall back to plain
                    // free-text fields for the rest of the address instead
                    // of a chain of dead dropdowns.
                    const cascadeUnavailable = regionsError

                    const provinceData = provincesCache[codes.regionCode]
                    const regionHasNoProvince = Boolean(
                      provinceData && !provinceData.loading && !provinceData.error && provinceData.list.length === 0
                    )
                    const citiesKey = citiesKeyFor(codes)
                    const cityData = citiesCache[citiesKey]
                    const barangayData = barangaysCache[codes.cityCode]

                    return (
                      <>
                        <div>
                          <label className="block text-sm text-gray-600">Region<Required /></label>
                          {locked ? (
                            <input type="text" value="—" disabled
                              className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-400" />
                          ) : cascadeUnavailable ? (
                            <>
                              <input type="text" value="Unavailable" disabled
                                className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-400" />
                              <p className="mt-1 text-xs text-gray-500">
                                Couldn't load the region list — fill in Province, City/Municipality and Barangay below instead.
                              </p>
                            </>
                          ) : (
                            <SearchableSelect
                              value={codes.regionCode}
                              options={regions.map((r) => ({ value: r.code, label: r.name }))}
                              onChange={(code) => handleRegionSelect(i, code)}
                              placeholder="Type to search…"
                              disabled={regions.length === 0}
                              disabledPlaceholder="Loading regions…"
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Province<Required /></label>
                          {locked ? (
                            <input type="text" value={p.province} disabled
                              className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500" />
                          ) : cascadeUnavailable || provinceData?.error ? (
                            <>
                              <input type="text" value={p.province}
                                onChange={(e) => updatePassenger(i, 'province', e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                              {provinceData?.error && (
                                <p className="mt-1 text-xs text-gray-500">Couldn't load the list — you can type it in.</p>
                              )}
                            </>
                          ) : regionHasNoProvince ? (
                            <input type="text" value="Not applicable" disabled
                              className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-400" />
                          ) : (
                            <SearchableSelect
                              value={codes.provinceCode}
                              options={(provinceData?.list || []).map((prov) => ({ value: prov.code, label: prov.name }))}
                              onChange={(code) => handleProvinceSelect(i, code)}
                              placeholder="Type to search…"
                              disabled={!codes.regionCode || provinceData?.loading || !(provinceData?.list || []).length}
                              disabledPlaceholder={!codes.regionCode ? 'Select region first' : provinceData?.loading ? 'Loading…' : 'Type to search…'}
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">City/Municipality<Required /></label>
                          {locked ? (
                            <input type="text" value={p.city_municipality} disabled
                              className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500" />
                          ) : cascadeUnavailable || cityData?.error ? (
                            <>
                              <input type="text" value={p.city_municipality}
                                onChange={(e) => updatePassenger(i, 'city_municipality', e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                              {cityData?.error && (
                                <p className="mt-1 text-xs text-gray-500">Couldn't load the list — you can type it in.</p>
                              )}
                            </>
                          ) : (
                            <SearchableSelect
                              value={codes.cityCode}
                              options={(cityData?.list || []).map((c) => ({ value: c.code, label: c.name }))}
                              onChange={(code) => handleCitySelect(i, code)}
                              placeholder="Type to search…"
                              disabled={!citiesKey || cityData?.loading || !(cityData?.list || []).length}
                              disabledPlaceholder={
                                !codes.regionCode
                                  ? 'Select region first'
                                  : !citiesKey
                                  ? 'Select province first'
                                  : cityData?.loading
                                  ? 'Loading…'
                                  : 'Type to search…'
                              }
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Barangay<Required /></label>
                          {locked ? (
                            <input type="text" value={p.barangay} disabled
                              className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500" />
                          ) : cascadeUnavailable || barangayData?.error ? (
                            <>
                              <input type="text" value={p.barangay}
                                onChange={(e) => updatePassenger(i, 'barangay', e.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                              {barangayData?.error && (
                                <p className="mt-1 text-xs text-gray-500">Couldn't load the list — you can type it in.</p>
                              )}
                            </>
                          ) : (
                            <SearchableSelect
                              value={p.barangay ? (barangayData?.list || []).find((b) => b.name === p.barangay)?.code || '' : ''}
                              options={(barangayData?.list || []).map((b) => ({ value: b.code, label: b.name }))}
                              onChange={(code) => {
                                const barangay = (barangayData?.list || []).find((b) => b.code === code)
                                updatePassenger(i, 'barangay', barangay ? barangay.name : '')
                              }}
                              placeholder="Type to search…"
                              disabled={!codes.cityCode || barangayData?.loading || !(barangayData?.list || []).length}
                              disabledPlaceholder={!codes.cityCode ? 'Select city/municipality first' : barangayData?.loading ? 'Loading…' : 'Type to search…'}
                            />
                          )}
                        </div>
                      </>
                    )
                  })()}
                  {(() => {
                    const codes = addressCodes[i] || emptyAddressCodes()
                    const locked = i === 0 && lockPassengerOneFields

                    // Postal Code is already shown above for foreign
                    // addresses — only Country is left to fill in here.
                    if (!locked && codes.foreign) {
                      return (
                        <div>
                          <label className="block text-sm text-gray-600">Country<Required /></label>
                          <input type="text" placeholder="e.g. United Kingdom" value={p.country}
                            onChange={(e) => updatePassenger(i, 'country', e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                        </div>
                      )
                    }

                    return (
                      <>
                        <div>
                          <label className="block text-sm text-gray-600">Zip Code<Required /></label>
                          <input type="text" inputMode="numeric" maxLength={4} placeholder="e.g. 6414" value={p.zip_code}
                            disabled={locked}
                            onChange={(e) => handleZipCodeChange(i, e.target.value, false)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500" />
                          {!locked && <p className="mt-1 text-xs text-gray-500">4-digit postal code.</p>}
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600">Country<Required /></label>
                          <input type="text" value="Philippines" disabled readOnly autoComplete="off"
                            className="mt-1 w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500" />
                          {!locked && (
                            <p className="mt-1 text-xs text-gray-500">
                              Check the box above if this passenger's address is outside the Philippines.
                            </p>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>

                <h4 className="mt-4 text-sm font-semibold text-gray-700">Contact &amp; Discount</h4>
                {!(i === 0 && lockPassengerOneFields) && (
                  <p className="mt-1 text-xs text-gray-500">
                    {i === 0 && !customer
                      ? 'Your booking confirmation, e-ticket, and any updates about this trip go to this email and number.'
                      : "This passenger's own contact details — used if we need to reach them directly."}
                  </p>
                )}
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-gray-600">
                      Email{i === 0 && !customer ? ' (used as your booking contact)' : ''}
                      {i === 0 && !customer && <Required />}
                    </label>
                    <input type="email" placeholder="e.g. juandelacruz@email.com" value={p.email}
                      disabled={i === 0 && lockPassengerOneFields}
                      onChange={(e) => updatePassenger(i, 'email', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500" />
                  </div>
                  {(() => {
                    const locked = i === 0 && lockPassengerOneFields
                    const foreign = !locked && Boolean((addressCodes[i] || emptyAddressCodes()).foreign)
                    return (
                      <div>
                        <label className="block text-sm text-gray-600">Contact Number</label>
                        <input
                          type="tel"
                          inputMode={foreign ? 'tel' : 'numeric'}
                          maxLength={foreign ? 20 : 11}
                          placeholder={foreign ? 'e.g. +44 7911 123456' : '09171234567'}
                          value={p.contact_number}
                          disabled={locked}
                          onChange={(e) => handleContactNumberChange(i, e.target.value, foreign)}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                        />
                        {!locked && (
                          <p className="mt-1 text-xs text-gray-500">
                            {foreign
                              ? 'Include your country code, e.g. +44 for the UK.'
                              : 'Philippine mobile number — 11 digits, starts with 09.'}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                  <div>
                    <label className="block text-sm text-gray-600">Discount Type</label>
                    <select
                      value={p.discount_type}
                      disabled={!canUseDiscount || (i === 0 && customer && !bookingForSelf)}
                      onChange={(e) => updatePassenger(i, 'discount_type', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="none">None</option>
                      {canUseDiscount && (
                        <option value={customer.discountType}>
                          {customer.discountType === 'senior' && `Senior Citizen (${seniorDiscountPercent}% off)`}
                          {customer.discountType === 'pwd' && `PWD (${pwdDiscountPercent}% off)`}
                          {customer.discountType === 'student' && `Student (${studentDiscountPercent}% off)`}
                          {' (verified)'}
                        </option>
                      )}
                    </select>
                    {!canUseDiscount && (
                      <p className="mt-1 text-xs text-gray-500">Log in with a verified profile to enable this.</p>
                    )}
                    {canUseDiscount && i === 0 && customer && !bookingForSelf && (
                      <p className="mt-1 text-xs text-gray-500">
                        Your discount only applies when you're the passenger.
                      </p>
                    )}
                  </div>
                </div>

                {/* Guest checkout has no account to check, so the email above
                    is verified on its own dedicated page instead of a
                    background flag. */}
                {i === 0 && !customer && (
                  <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3.5">
                    {guestVerifiedEmail && guestVerifiedEmail.toLowerCase() === contactEmail.trim().toLowerCase() ? (
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-teal-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                          Verified
                        </span>
                        <p className="text-sm font-medium text-teal-700">Email confirmed — you're clear to book.</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700">
                          Booking as a guest requires verifying your email first. You'll be sent a 6-digit code on
                          the next page — your details here are saved, so you'll come right back to them.
                        </p>
                        <button
                          type="button"
                          onClick={handleGoToGuestVerification}
                          disabled={!contactEmail.trim()}
                          className="mt-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Verify My Email
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </>
      )}

      {!booking && phase === 'review' && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Review Your Booking</h2>
          <p className="mt-1 text-sm text-gray-600">Double-check everything before confirming.</p>

          <div className="mt-4 space-y-3">
            {passengers.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3">
                <div>
                  <p className="font-medium text-gray-800">{passengerFullName(p) || `Passenger ${i + 1}`}</p>
                  <p className="text-xs text-gray-500">
                    {p.discount_type === 'none' ? 'Regular fare' : `${p.discount_type} discount`}
                  </p>
                </div>
                <p className="font-semibold text-teal-700">&#8369;{estimateFare(p).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600">
            <p><span className="font-medium">Contact email:</span> {contactEmail}</p>
            <p className="mt-1"><span className="font-medium">Contact number:</span> {contactNumber || '—'}</p>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="font-semibold text-gray-800">Estimated Total</p>
            <p className="text-xl font-bold text-teal-700">&#8369;{estimatedTotal.toFixed(2)}</p>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6">
            <button
              onClick={() => setPhase('form')}
              className="rounded-md border border-gray-300 px-5 py-2 font-medium text-gray-700 hover:bg-gray-50"
            >
              ← Edit Details
            </button>
          </div>
        </div>
      )}

      {booking && (
        <div className="mt-6 rounded-lg border border-teal-200 bg-teal-50 p-6 text-center">
          <h2 className="text-xl font-bold text-gray-800">Booking Confirmed!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Your reference code (save this — you'll need it to manage your booking):
          </p>
          <div className="mt-2 text-2xl font-bold tracking-wide text-teal-700">
            {booking.referenceCode}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Total to pay: <b>&#8369;{booking.totalFare}</b>
          </p>

          <Link
            to={`/directions?direction=${direction}`}
            className="mt-4 inline-block rounded-md border border-teal-700 px-5 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
          >
            Get Directions to the Port
          </Link>

          {paymentStatus === 'paid' && (
            <div className="mt-6 rounded-md bg-teal-100 p-4">
              <p className="font-semibold text-teal-800">Payment received. Your booking is confirmed!</p>
            </div>
          )}

          {paymentStatus === 'loading' && (
            <p className="mt-6 text-sm text-gray-600">Generating your QR code...</p>
          )}

          {paymentStatus === 'awaiting_payment' && qrCodeImageUrl && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-800">Scan to Pay with QR Ph</h3>
              <p className="mt-1 text-xs text-gray-500">
                Use your banking or e-wallet app (GCash, Maya, and more)
              </p>
              <img
                src={qrCodeImageUrl}
                alt="Scan to pay"
                className="mx-auto mt-3 h-56 w-56 rounded-md border border-gray-200 bg-white p-2"
              />

              {/* Booking from the same phone you'd use to scan? You can't point
                  a camera at the screen it's displayed on. GCash, Maya, and
                  most banking apps also let you scan a QR image saved to your
                  gallery instead of using the live camera, so offer that as
                  the on-device path. The QR image is hosted by our payment
                  provider on a different domain, so a plain download link
                  can't reliably force-save it — a long-press works in every
                  mobile browser regardless. */}
              <div className="mx-auto mt-4 max-w-sm rounded-lg border border-teal-100 bg-teal-50 p-4 text-left">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <rect x="7" y="2" width="10" height="20" rx="2" />
                      <path strokeLinecap="round" d="M11 18h2" />
                    </svg>
                  </span>
                  <p className="text-sm font-semibold text-gray-800">Paying with the phone you're on right now?</p>
                </div>
                <ol className="mt-3 space-y-2.5">
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-teal-700 ring-1 ring-teal-200">
                      1
                    </span>
                    <p className="text-xs leading-relaxed text-gray-700">
                      Press and hold the QR code above, then choose{' '}
                      <span className="font-semibold">"Save Image"</span> (or "Add to Photos").
                    </p>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-teal-700 ring-1 ring-teal-200">
                      2
                    </span>
                    <p className="text-xs leading-relaxed text-gray-700">
                      Open your GCash, Maya, or banking app and choose{' '}
                      <span className="font-semibold">"Scan QR" &rarr; "Upload from Gallery"</span> to pay with the
                      saved image.
                    </p>
                  </li>
                </ol>
              </div>

              <p className="mt-3 text-sm text-gray-600">Waiting for payment confirmation...</p>
              <p className="mt-1 text-xs text-gray-500">This code expires in 30 minutes.</p>
              {testUrl && (
                <p className="mt-4 text-xs text-gray-500">
                  Test mode — do not scan this with a real banking app.{' '}
                  <a
                    href={testUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 underline"
                  >
                    Simulate payment instead
                  </a>
                </p>
              )}
            </div>
          )}

          {paymentStatus === 'expired' && (
            <div className="mt-6">
              <p className="text-sm text-red-600">This QR code expired before payment was completed.</p>
              <button
                onClick={startPayment}
                className="mt-3 rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800"
              >
                Generate a New QR Code
              </button>
            </div>
          )}

          {paymentStatus === 'error' && (
            <div className="mt-6">
              <p className="text-sm text-red-600">{paymentError}</p>
              <button
                onClick={startPayment}
                className="mt-3 rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800"
              >
                Try Again
              </button>
            </div>
          )}

        </div>
      )}

      {/* Summary bar — on desktop this is pinned to the bottom of the screen
          through Passenger and Review so the trip, running total, and next
          action are always visible without scrolling back up (the same way
          OceanJet's booking flow keeps its bottom bar in place). On a small
          screen it stays in the normal page flow instead of floating fixed —
          a bar permanently glued to the bottom eats too much of an already
          small viewport, so there it just appears as the last card on the
          page, right where the old inline summary used to sit. Hidden once
          a booking exists, since the QR/payment screen has its own flow. */}
      {!booking && (
        <div className="static mt-6 border-t border-teal-900 bg-teal-950 text-white sm:fixed sm:inset-x-0 sm:bottom-0 sm:z-40 sm:mt-0 sm:shadow-lg">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-4 sm:flex-nowrap sm:justify-between sm:gap-6 sm:py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-sm">
                <img src="/evershine-logo.png" alt="Evershine" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-teal-300">Departure</p>
                <p className="truncate text-sm font-semibold">{directionLabel[direction]}</p>
                <p className="truncate text-xs text-teal-300">{new Date(datetime).toLocaleString()}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-teal-300">Passengers</p>
              <p className="text-sm font-semibold">
                {passengers.length} Passenger{passengers.length === 1 ? '' : 's'}
              </p>
            </div>

            <div>
              <p className="text-xs text-teal-300">Total</p>
              <p className="text-lg font-bold leading-tight">{formatPeso(estimatedTotal)}</p>
            </div>

            <div className="w-full sm:w-auto">
              {phase === 'form' ? (
                <button
                  onClick={goToReview}
                  disabled={emailNeedsVerification}
                  title={emailNeedsVerification ? 'Verify your email above to continue' : undefined}
                  className="w-full whitespace-nowrap rounded-md bg-white px-5 py-2 font-medium text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:bg-teal-800 disabled:text-teal-500 sm:w-auto"
                >
                  Proceed
                </button>
              ) : (
                <button
                  onClick={submitBooking}
                  disabled={submitting}
                  className="w-full whitespace-nowrap rounded-md bg-white px-5 py-2 font-medium text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {submitting ? 'Confirming...' : 'Confirm & Pay'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
