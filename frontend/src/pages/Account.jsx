// Save as: frontend/src/pages/Account.jsx

import { useState, useEffect, useRef } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { PORT_NAMES } from '../lib/portUtils.js'

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
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

// Live camera-only capture (no gallery upload) — used for the mandatory
// selfie in Profile Verification. Requests the front camera on demand
// (button press, not auto-start), draws the current frame to a hidden
// canvas to produce a File, and stops the camera stream as soon as either
// a photo is captured or the component unmounts.
function SelfieCapture({ file, onChange }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setActive(false)
  }

  async function startCamera() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support camera access. Try a recent version of Chrome, Safari, or Edge.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      setActive(true)
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Camera access was blocked. Please allow camera permission in your browser to continue verification.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera was found on this device.')
      } else {
        setError('Could not access the camera. Please try again.')
      }
    }
  }

  function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      onChange(new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      stopCamera()
    }, 'image/jpeg', 0.92)
  }

  function retake() {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    onChange(null)
    startCamera()
  }

  if (file && previewUrl) {
    return (
      <div className="mt-1.5 overflow-hidden rounded-md border border-gray-300">
        <img src={previewUrl} alt="Captured selfie" className="aspect-[4/3] w-full object-cover" />
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-xs font-medium text-gray-700">Selfie captured</span>
          <button type="button" onClick={retake} className="text-xs font-medium text-teal-700 hover:underline">
            Retake
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-1.5 overflow-hidden rounded-md border border-dashed border-gray-300">
      {active ? (
        <div className="relative bg-black">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full scale-x-[-1] object-cover" />
          <div className="border-t border-gray-700 bg-black p-2 text-center">
            <button
              type="button"
              onClick={capture}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            >
              Capture Photo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCamera}
          className="flex w-full flex-col items-center justify-center gap-1.5 px-4 py-6 text-center transition-colors hover:border-teal-400 hover:bg-teal-50"
        >
          <span className="text-sm font-medium text-teal-700">Turn on camera to take a live selfie</span>
          <span className="text-xs text-gray-500">Required for verification — camera only, no gallery uploads</span>
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {error && <p className="border-t border-gray-200 px-3 pb-3 pt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// Plain typographic heading reused across every card so the page reads as
// one coherent system instead of five differently-styled boxes.
function CardHeading({ children, action }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-gray-100 pb-3">
      <h2 className="text-base font-semibold text-gray-800">{children}</h2>
      {action}
    </div>
  )
}

// customer.name (from the backend) is first + last only, kept as a fallback
// for older cached data. The full legal name — with middle name and suffix
// — is composed here from the separate structured fields for display.
function fullLegalName(customer) {
  return [customer.firstName, customer.middleName, customer.lastName, customer.suffix].filter(Boolean).join(' ')
}

function fullAddress(customer) {
  const parts = [customer.barangay, customer.cityMunicipality, customer.province, customer.region].filter(Boolean)
  const line = parts.join(', ')
  return customer.zipCode ? `${line} ${customer.zipCode}` : line
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Read-only summary of everything on the account — editing happens on its
// own dedicated page (EditProfile.jsx) rather than inline here, since the
// full name + address form is long enough to deserve its own screen instead
// of expanding awkwardly inside this card.
function ProfileCard({ customer }) {
  return (
    <div className="rounded-xl border border-l-4 border-gray-200 border-l-teal-700 bg-white p-6">
      <CardHeading
        action={
          <Link to="/account/edit" className="text-sm font-semibold text-teal-700 hover:underline">
            Edit
          </Link>
        }
      >
        Profile
      </CardHeading>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Full Name</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">{fullLegalName(customer) || customer.name}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">
            {customer.email}{' '}
            <span className={`ml-1 text-xs font-normal ${customer.emailVerified ? 'text-teal-700' : 'text-amber-700'}`}>
              ({customer.emailVerified ? 'Verified' : 'Not verified'})
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Contact Number</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">
            {customer.contactNumber || <span className="font-normal text-gray-400">Not set</span>}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Address</p>
          <p className="mt-0.5 text-sm font-medium text-gray-800">
            {fullAddress(customer) || <span className="font-normal text-gray-400">Not set</span>}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Discount Eligibility</p>
          <p className="mt-0.5 text-sm font-medium capitalize text-gray-800">
            {customer.discountType === 'none' ? (
              <span className="font-normal capitalize text-gray-400">None on file</span>
            ) : (
              <>
                {customer.discountType} &middot; <span className="capitalize">{customer.discountStatus.replace('_', ' ')}</span>
                {customer.discountStatus === 'verified' && customer.discountVerifiedUntil && (
                  <span className="font-normal normal-case text-gray-500"> (valid until {formatDate(customer.discountVerifiedUntil)})</span>
                )}
              </>
            )}
          </p>
        </div>
        {formatDate(customer.createdAt) && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Member Since</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800">{formatDate(customer.createdAt)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Reused for both sides of the ID — click-to-upload dropzone that swaps to
// a filename/size preview once a file is picked, same treatment for front
// and back so the form reads as one consistent pattern.
function IdUploadField({ label, hint, file, onChange }) {
  return (
    <>
      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      {file ? (
        <div className="mt-1.5 flex items-center gap-3 rounded-md border border-gray-300 bg-gray-50 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex-shrink-0 text-xs font-medium text-gray-600 hover:text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 px-4 py-6 text-center transition-colors hover:border-teal-400 hover:bg-teal-50">
          <span className="text-sm font-medium text-teal-700">Click to upload {label.toLowerCase()}</span>
          <span className="text-xs text-gray-500">JPG or PNG</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onChange(e.target.files[0] || null)}
            className="hidden"
          />
        </label>
      )}
    </>
  )
}

// Profile Verification is the single gate for discount eligibility — there's
// no separate "discount status" anymore. Submitting requires a live camera
// photo (which also becomes the account's permanent profile picture, see
// the hero banner in Account() below), a valid ID, and the discount type
// being verified for. An admin approving the request is what makes the
// customer both "Profile Verified" and eligible for that discount.
function ProfileVerificationCard({ customer, onUpdated }) {
  const [discountType, setDiscountType] = useState('senior')
  const [file, setFile] = useState(null)
  const [backFile, setBackFile] = useState(null)
  const [selfieFile, setSelfieFile] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submitVerificationRequest() {
    setMessage('')
    setError(false)
    if (!selfieFile) {
      setMessage('A live profile photo is required for verification.')
      setError(true)
      return
    }
    if (!file) {
      setMessage('Please upload a photo of the front of your ID.')
      setError(true)
      return
    }
    if (!backFile) {
      setMessage('Please upload a photo of the back of your ID.')
      setError(true)
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('discount_type', discountType)
      formData.append('discount_id', file)
      formData.append('discount_id_back', backFile)
      formData.append('selfie', selfieFile)
      await api.requestDiscount(formData)
      setMessage('Submitted! An admin will review it shortly.')
      setError(false)
      await onUpdated()
    } catch (err) {
      setMessage(err.message)
      setError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const statusStyles = {
    verified: 'border-teal-200 bg-teal-50 text-teal-700',
    expired: 'border-red-200 bg-red-50 text-red-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    rejected: 'border-red-200 bg-red-50 text-red-700',
    none: 'border-gray-200 bg-gray-50 text-gray-600',
  }

  return (
    <div id="profile-verification" className="scroll-mt-24 rounded-xl border border-l-4 border-gray-200 border-l-amber-600 bg-white p-6">
      <CardHeading>Profile Verification</CardHeading>

      <div className={`mt-4 rounded-lg border p-4 text-sm ${statusStyles[customer.discountStatus] || statusStyles.none}`}>
        {customer.discountStatus === 'verified' && (
          <>
            You're Profile Verified, which makes you eligible for the{' '}
            <span className="font-semibold capitalize">{customer.discountType}</span> discount.
            It applies automatically to your bookings while you're logged in.
            {customer.discountVerifiedUntil && (
              <> Valid until <b>{new Date(customer.discountVerifiedUntil).toLocaleDateString()}</b>.</>
            )}
          </>
        )}
        {customer.discountStatus === 'expired' && (
          <>
            Your Profile Verification (for the <span className="capitalize">{customer.discountType}</span> discount) expired on{' '}
            {new Date(customer.discountVerifiedUntil).toLocaleDateString()}. Submit again below to renew your eligibility.
          </>
        )}
        {customer.discountStatus === 'pending' && (
          <>Your Profile Verification is under review. Check back later — you're not yet eligible for the <span className="capitalize">{customer.discountType}</span> discount until it's approved.</>
        )}
        {customer.discountStatus === 'rejected' && 'Your last Profile Verification request was not approved. You can submit a new one below.'}
        {customer.discountStatus === 'none' && "You're not Profile Verified yet. Verifying is required to become eligible for a Senior, PWD, or Student discount."}
      </div>

      {['none', 'rejected', 'expired'].includes(customer.discountStatus) && (
        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Live Profile Photo</label>
          <p className="mt-0.5 text-xs text-gray-400">
            Take a live photo with your camera — required to verify your profile. This also becomes your profile picture.
          </p>
          <SelfieCapture file={selfieFile} onChange={setSelfieFile} />

          <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-500">Discount Type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
          >
            <option value="senior">Senior Citizen</option>
            <option value="pwd">PWD</option>
            <option value="student">Student</option>
          </select>

          <IdUploadField label="ID (Front)" file={file} onChange={setFile} />
          <IdUploadField
            label="ID (Back)"
            hint="Most IDs print the expiry date on the back — we need both sides."
            file={backFile}
            onChange={setBackFile}
          />

          <button
            onClick={submitVerificationRequest}
            disabled={submitting || !file || !backFile || !selfieFile}
            className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit for Verification'}
          </button>

          {message && <p className={`mt-3 text-sm ${error ? 'text-red-600' : 'text-teal-700'}`}>{message}</p>}
        </div>
      )}
    </div>
  )
}

function BookingHistoryCard() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api.getMyBookings()
      .then((data) => { if (!cancelled) setBookings(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="rounded-xl border border-l-4 border-gray-200 border-l-blue-600 bg-white p-6">
      <CardHeading>My Bookings</CardHeading>

      {loading && <p className="mt-5 text-sm text-gray-500">Loading your bookings...</p>}
      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}

      {!loading && !error && bookings.length === 0 && (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 py-10 text-center">
          <p className="text-sm text-gray-500">No bookings yet under this account.</p>
          <p className="mt-1 text-xs text-gray-400">Bookings you make while logged in will show up here.</p>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <div className="mt-5 space-y-3">
          {bookings.map((b) => {
            const ports = PORT_NAMES[b.schedule?.direction] || { from: '', to: '' }
            return (
              <Link
                key={b.id}
                to={`/manage-booking?reference_code=${encodeURIComponent(b.referenceCode)}&contact_email=${encodeURIComponent(b.contactEmail)}`}
                className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {ports.from} &rarr; {ports.to}
                    </p>
                    {b.schedule?.departureDatetime && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {new Date(b.schedule.departureDatetime).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gray-100 pt-3 text-sm text-gray-600">
                  <span>Ref: <span className="font-medium text-gray-800">{b.referenceCode}</span></span>
                  <span>{b.passengers?.length || 0} passenger{b.passengers?.length === 1 ? '' : 's'}</span>
                  <span className="ml-auto text-base font-semibold text-gray-800">{formatPeso(b.totalFare)}</span>
                </div>
                <div className="mt-3 border-t border-gray-100 pt-2.5 text-right text-sm font-medium text-teal-700">
                  View details &rarr;
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function IconNavDashboard(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </svg>
  )
}

function IconNavProfile(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.5" />
      <path strokeLinecap="round" d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  )
}

function IconNavBookings(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z" />
      <path strokeLinecap="round" d="M12 5v14" strokeDasharray="2 2" />
    </svg>
  )
}

function IconNavVerification(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconNavDirections(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  )
}

// Left sidebar navigation for the account area, splitting what used to be
// one long scrolling page of cards into separate sections the customer picks
// between, the same "persistent side menu + single content pane" pattern
// as a typical account dashboard. Most items just switch which section shows
// in the content pane on the right (id), but Directions is a real full page
// with its own Leaflet map (a heavy, lazy-loaded dependency, see App.jsx),
// so it navigates to its own route (to) instead of joining the in-page tabs,
// keeping the map library out of the bundle for anyone who never opens it.
const ACCOUNT_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: IconNavDashboard },
  { id: 'profile', label: 'Profile', icon: IconNavProfile },
  { id: 'bookings', label: 'My Bookings', icon: IconNavBookings },
  { id: 'verification', label: 'Profile Verification', icon: IconNavVerification },
  { to: '/directions', label: 'Port Directions', icon: IconNavDirections },
]

function AccountSidebar({ activeTab, onSelect }) {
  return (
    <nav className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:sticky lg:top-24">
      {ACCOUNT_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        if (item.to) {
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex w-full items-center gap-3 border-l-4 border-transparent px-4 py-3 text-left text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        }
        const active = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex w-full items-center gap-3 border-l-4 px-4 py-3 text-left text-sm font-medium transition-colors ${
              active
                ? 'border-teal-700 bg-teal-50 text-teal-800'
                : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function DashboardSection({ customer, navigate }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-800">Welcome back, {customer.firstName || customer.name}</h2>
        <p className="mt-1 text-sm text-gray-500">Here's a quick overview of your account.</p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</p>
            <p className={`mt-1 text-sm font-semibold ${customer.emailVerified ? 'text-teal-700' : 'text-amber-700'}`}>
              {customer.emailVerified ? 'Verified' : 'Not verified'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Discount Eligibility</p>
            <p className="mt-1 text-sm font-semibold capitalize text-gray-800">
              {customer.discountType === 'none'
                ? 'None on file'
                : `${customer.discountType} (${customer.discountStatus.replace('_', ' ')})`}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Member Since</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{formatDate(customer.createdAt) || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Quick actions — both styled identically (solid teal) so neither
          reads as the "active" or default choice; a plain solid fill on
          both avoids the earlier problem where only one looked selected. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-between rounded-xl border border-teal-700 bg-teal-700 p-5 text-left text-white transition-colors hover:bg-teal-800"
        >
          <div className="min-w-0">
            <p className="font-semibold">Book a New Trip</p>
            <p className="mt-0.5 text-xs text-teal-100">Search sailings to Limasawa or Padre Burgos</p>
          </div>
          <span className="ml-4 flex-shrink-0 text-lg">&rarr;</span>
        </button>
        <button
          onClick={() => navigate('/manage-booking')}
          className="flex items-center justify-between rounded-xl border border-teal-700 bg-teal-700 p-5 text-left text-white transition-colors hover:bg-teal-800"
        >
          <div className="min-w-0">
            <p className="font-semibold">Manage a Booking</p>
            <p className="mt-0.5 text-xs text-teal-100">Look up any booking by reference code</p>
          </div>
          <span className="ml-4 flex-shrink-0 text-lg">&rarr;</span>
        </button>
      </div>
    </div>
  )
}

export default function Account() {
  const { customer, loading, refreshMe } = useAuth()
  const navigate = useNavigate()

  const [resendingVerification, setResendingVerification] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')

  async function handleResendVerification() {
    setResendingVerification(true)
    setResendMessage('')
    try {
      const data = await api.resendVerification()
      setResendMessage(data.message)
    } catch (err) {
      setResendMessage(err.message)
    } finally {
      setResendingVerification(false)
    }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>
  if (!customer) return <Navigate to="/account/login" replace />

  async function handleVerificationUpdated() {
    await refreshMe()
  }

  return (
    <div>
      {/* Unverified-email notice — separate from Profile Verification below.
          This just confirms the customer controls their inbox; it doesn't
          block login or booking. */}
      {!customer.emailVerified && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span><strong>Action needed:</strong> Please verify your email address. Check your inbox at {customer.email} for a link.</span>
          <div className="flex flex-shrink-0 items-center gap-2">
            {resendMessage && <span className="text-xs text-amber-800">{resendMessage}</span>}
            <button
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="whitespace-nowrap rounded-md border border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {resendingVerification ? 'Sending...' : 'Resend Email'}
            </button>
          </div>
        </div>
      )}

      {/* Not-verified notice — only shown when there's something to act on
          (never verified, or a previous submission expired/was rejected).
          Silent for 'pending' (already submitted, nothing to do) and
          'verified' (nothing to warn about). Switches to the Profile
          Verification tab instead of anchor-scrolling, now that section
          lives behind the sidebar instead of further down the same page. */}
      {['none', 'rejected', 'expired'].includes(customer.discountStatus) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>
            <strong>Action needed:</strong>{' '}
            {customer.discountStatus === 'rejected'
              ? "Your Profile Verification wasn't approved. Submit again to become eligible for a discount."
              : customer.discountStatus === 'expired'
              ? 'Your Profile Verification has expired. Renew it to keep your discount eligibility.'
              : "Your profile isn't verified yet. Verify it to unlock Senior, PWD, or Student discounts."}
          </span>
          <button
            onClick={() => setActiveTab('verification')}
            className="flex-shrink-0 whitespace-nowrap rounded-md border border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Verify Now
          </button>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <AccountSidebar activeTab={activeTab} onSelect={setActiveTab} />

        <div>
          {activeTab === 'dashboard' && <DashboardSection customer={customer} navigate={navigate} />}
          {activeTab === 'profile' && <ProfileCard customer={customer} />}
          {activeTab === 'bookings' && <BookingHistoryCard />}
          {activeTab === 'verification' && (
            <ProfileVerificationCard customer={customer} onUpdated={handleVerificationUpdated} />
          )}
        </div>
      </div>
    </div>
  )
}
