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
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function formatPeso(amount) {
  return `₱${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function SelfieCapture({ file, onChange }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    return () => stopCamera()

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
      <div className="mt-2 overflow-hidden rounded-md border border-gray-300">
        <img src={previewUrl} alt="Captured selfie" className="aspect-[4/3] w-full object-cover" />
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
          <span className="text-sm font-medium text-gray-700">Selfie captured</span>
          <button type="button" onClick={retake} className="text-sm font-medium text-teal-700 hover:underline">
            Retake
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-dashed border-gray-300">
      {active ? (
        <div className="relative bg-black">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full scale-x-[-1] object-cover" />
          <div className="border-t border-gray-700 bg-black p-3 text-center">
            <button
              type="button"
              onClick={capture}
              className="rounded-md bg-white px-5 py-2.5 text-base font-semibold text-gray-800 hover:bg-gray-100"
            >
              Capture Photo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCamera}
          className="flex w-full flex-col items-center justify-center gap-2 px-4 py-7 text-center transition-colors hover:border-teal-400 hover:bg-teal-50"
        >
          <span className="text-base font-medium text-teal-700">Turn on camera to take a live selfie</span>
          <span className="text-sm text-gray-500">Required for verification, camera only, no gallery uploads</span>
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {error && <p className="border-t border-gray-200 px-4 pb-4 pt-2.5 text-sm text-red-600">{error}</p>}
    </div>
  )
}


function CardHeading({ children, action }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-gray-100 pb-4">
      <h2 className="text-xl font-semibold text-gray-800">{children}</h2>
      {action}
    </div>
  )
}


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

function InfoField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-sm font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-lg font-medium text-gray-800">{children}</div>
    </div>
  )
}

function ProfileCard({ customer }) {
  const notSet = <span className="font-normal text-gray-400">Not set</span>
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-7">
      <CardHeading
        action={
          <Link
            to="/account/edit"
            className="rounded-md bg-teal-700 px-5 py-2 text-base font-semibold text-white transition-colors hover:bg-teal-800"
          >
            Edit Profile
          </Link>
        }
      >
        Profile Details
      </CardHeading>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <InfoField label="Full Name">{fullLegalName(customer) || customer.name}</InfoField>
        <InfoField label="Email">
          <span className="break-all">{customer.email}</span>{' '}
          <span
            className={`ml-1 inline-block rounded-full border px-2.5 py-0.5 align-middle text-xs font-semibold ${
              customer.emailVerified
                ? 'border-teal-200 bg-teal-50 text-teal-800'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            {customer.emailVerified ? 'Verified' : 'Not verified'}
          </span>
        </InfoField>
        <InfoField label="Contact Number">{customer.contactNumber || notSet}</InfoField>
        <InfoField label="Member Since">{formatDate(customer.createdAt) || notSet}</InfoField>
        <InfoField label="Address" className="sm:col-span-2">{fullAddress(customer) || notSet}</InfoField>
        <InfoField label="Discount Eligibility" className="sm:col-span-2">
          {customer.discountType === 'none' ? (
            <span className="font-normal text-gray-400">None on file</span>
          ) : (
            <>
              <span className="capitalize">{customer.discountType}</span> &middot;{' '}
              <span className="capitalize">{customer.discountStatus.replace('_', ' ')}</span>
              {customer.discountStatus === 'verified' && customer.discountVerifiedUntil && (
                <span className="font-normal text-gray-500"> (valid until {formatDate(customer.discountVerifiedUntil)})</span>
              )}
            </>
          )}
        </InfoField>
      </div>
    </div>
  )
}


function IdUploadField({ label, hint, file, onChange }) {
  return (
    <>
      <label className="mt-5 block text-sm font-medium uppercase tracking-wide text-gray-500">{label}</label>
      {hint && <p className="mt-1 text-sm text-gray-400">{hint}</p>}
      {file ? (
        <div className="mt-2 flex items-center gap-3 rounded-md border border-gray-300 bg-gray-50 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-gray-800">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex-shrink-0 text-sm font-medium text-gray-600 hover:text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-4 py-7 text-center transition-colors hover:border-teal-400 hover:bg-teal-50">
          <span className="text-base font-medium text-teal-700">Click to upload {label.toLowerCase()}</span>
          <span className="text-sm text-gray-500">JPG or PNG</span>
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
    <div id="profile-verification" className="scroll-mt-24 rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-7">
      <CardHeading>Profile Verification</CardHeading>

      <div className={`mt-5 rounded-lg border p-5 text-base ${statusStyles[customer.discountStatus] || statusStyles.none}`}>
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
          <>Your Profile Verification is under review. Check back later, you're not yet eligible for the <span className="capitalize">{customer.discountType}</span> discount until it's approved.</>
        )}
        {customer.discountStatus === 'rejected' && 'Your last Profile Verification request was not approved. You can submit a new one below.'}
        {customer.discountStatus === 'none' && "You're not Profile Verified yet. Verifying is required to become eligible for a Senior, PWD, or Student discount."}
      </div>

      {['none', 'rejected', 'expired'].includes(customer.discountStatus) && (
        <div className="mt-5">
          <label className="block text-sm font-medium uppercase tracking-wide text-gray-500">Live Profile Photo</label>
          <SelfieCapture file={selfieFile} onChange={setSelfieFile} />

          <label className="mt-5 block text-sm font-medium uppercase tracking-wide text-gray-500">Discount Type</label>
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            className="mt-2 w-full rounded-md border border-gray-300 px-4 py-3 text-base"
          >
            <option value="senior">Senior Citizen</option>
            <option value="pwd">PWD</option>
            <option value="student">Student</option>
          </select>

          <IdUploadField label="ID (Front)" file={file} onChange={setFile} />
          <IdUploadField
            label="ID (Back)"
            file={backFile}
            onChange={setBackFile}
          />

          <button
            onClick={submitVerificationRequest}
            disabled={submitting || !file || !backFile || !selfieFile}
            className="mt-5 rounded-md bg-teal-700 px-5 py-2.5 text-base font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit for Verification'}
          </button>

          {message && <p className={`mt-3 text-base ${error ? 'text-red-600' : 'text-teal-700'}`}>{message}</p>}
        </div>
      )}
    </div>
  )
}

function BookingHistoryCard({ bookings, loading, error }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-7">
      <CardHeading
        action={
          !loading && bookings.length > 0 ? (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
              {bookings.length} total
            </span>
          ) : null
        }
      >
        My Bookings
      </CardHeading>

      {loading && <p className="mt-5 text-base text-gray-500">Loading your bookings...</p>}
      {error && <p className="mt-5 text-base text-red-600">{error}</p>}

      {!loading && !error && bookings.length === 0 && (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-base text-gray-500">No bookings yet under this account.</p>
          <p className="mt-1.5 text-sm text-gray-400">Bookings you make while logged in will show up here.</p>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <div className="mt-5 space-y-3">
          {bookings.map((b) => {
            const ports = PORT_NAMES[b.schedule?.direction] || { from: '', to: '' }
            const departure = b.schedule?.departureDatetime ? new Date(b.schedule.departureDatetime) : null
            const passengerCount = b.passengers?.length || 0
            return (
              <Link
                key={b.id}
                to={`/manage-booking?reference_code=${encodeURIComponent(b.referenceCode)}&contact_email=${encodeURIComponent(b.contactEmail)}`}
                className="flex items-stretch gap-4 rounded-lg border border-gray-200 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50/40 sm:gap-5 sm:p-5"
              >
                <div className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-center">
                  <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                    {departure ? departure.toLocaleDateString('en-US', { month: 'short' }) : '--'}
                  </span>
                  <span className="text-2xl font-bold leading-none text-gray-800">
                    {departure ? departure.getDate() : '--'}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <p className="text-lg font-semibold text-gray-800">
                      {ports.from} &rarr; {ports.to}
                    </p>
                    <StatusBadge status={b.status} />
                  </div>
                  {departure && (
                    <p className="mt-0.5 text-base text-gray-500">
                      {departure.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' '}&middot;{' '}
                      {departure.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric' })}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 border-t border-gray-100 pt-3 text-base text-gray-600">
                    <span>
                      Ref <span className="font-semibold tracking-wide text-gray-800">{b.referenceCode}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      {passengerCount} passenger{passengerCount === 1 ? '' : 's'}
                    </span>
                    <span className="text-xl font-semibold text-gray-800">{formatPeso(b.totalFare)}</span>
                  </div>
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


const ACCOUNT_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: IconNavDashboard },
  { id: 'profile', label: 'Profile', icon: IconNavProfile },
  { id: 'bookings', label: 'My Bookings', icon: IconNavBookings },
  { id: 'verification', label: 'Verification', icon: IconNavVerification },
]


function AccountTabs({ activeTab, onSelect, upcomingCount }) {
  const tabBase =
    'relative flex flex-1 flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap px-2.5 py-3.5 text-sm font-semibold transition-colors sm:px-4 sm:py-4 sm:text-base'
  return (
    <div className="no-scrollbar flex justify-between gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white px-2 shadow-md sm:px-3">
      {ACCOUNT_NAV_ITEMS.map((item) => {
        if (item.to) {
          return (
            <Link key={item.to} to={item.to} className={`${tabBase} text-gray-600 hover:text-gray-900`}>
              {item.label}
            </Link>
          )
        }
        const active = activeTab === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`${tabBase} ${active ? 'text-teal-700' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {item.label}
            {item.id === 'bookings' && upcomingCount > 0 && (
              <span className="rounded-full bg-teal-700 px-2 py-0.5 text-xs font-bold text-white">{upcomingCount}</span>
            )}
            {active && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-teal-700" />}
          </button>
        )
      })}
    </div>
  )
}

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function DetailIcon({ name, className = 'h-5 w-5' }) {
  const paths = {
    pin: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
    phone: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    tag: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12V4h8l10 10-8 8L3 12z" />
        <circle cx="7.5" cy="8.5" r="1.2" />
      </>
    ),
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      {paths[name]}
    </svg>
  )
}

function DetailRow({ icon, children, tone = 'text-gray-600' }) {
  return (
    <li className="flex items-start gap-3">
      <DetailIcon name={icon} className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
      <span className={`min-w-0 break-words text-base leading-snug ${tone}`}>{children}</span>
    </li>
  )
}


function ProfileSideCard({ customer, photoUrl, navigate }) {
  const name = fullLegalName(customer) || customer.name
  const profileVerified = customer.discountStatus === 'verified'
  const discountLine =
    customer.discountType === 'none'
      ? 'Regular fare, no discount on file'
      : `${customer.discountType.charAt(0).toUpperCase()}${customer.discountType.slice(1)} discount (${customer.discountStatus.replace('_', ' ')})`
  return (
    <div>
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-lg sm:p-6">
     
        <div className="flex items-center gap-4 lg:flex-col lg:gap-0">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Your profile photo"
            className="h-20 w-20 flex-shrink-0 rounded-full border-4 border-white bg-white object-cover shadow-md sm:h-24 sm:w-24 lg:h-32 lg:w-32"
          />
        ) : (
          <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-4 border-white bg-teal-700 text-2xl font-bold text-white shadow-md sm:h-24 sm:w-24 sm:text-3xl lg:h-32 lg:w-32 lg:text-4xl">
            {initialsOf(name)}
          </span>
        )}

        <div className="min-w-0 lg:mt-5 lg:text-center">
          <h1 className="flex items-center gap-1.5 text-xl font-bold text-gray-800 sm:text-2xl lg:justify-center">
            <span className="break-words">{name}</span>
            {profileVerified && (
              <svg viewBox="0 0 24 24" className="h-6 w-6 flex-shrink-0 text-teal-700" fill="currentColor" aria-label="Profile verified">
                <path d="M12 2l2.4 1.9 3-.2 1.1 2.8 2.6 1.5-.7 2.9L22 12l-1.6 2.1.7 2.9-2.6 1.5-1.1 2.8-3-.2L12 22l-2.4-1.9-3 .2-1.1-2.8-2.6-1.5.7-2.9L2 12l1.6-2.1-.7-2.9 2.6-1.5 1.1-2.8 3 .2L12 2z" />
                <path d="M8.5 12.2l2.4 2.4 4.6-4.9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </h1>
          <p className="mt-0.5 break-all text-base text-gray-500">{customer.email}</p>
        </div>
        </div>

        <ul className="mt-5 grid grid-cols-1 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:mt-6 lg:grid-cols-1">
          <DetailRow icon="pin">{fullAddress(customer) || <span className="text-gray-400">Address not set</span>}</DetailRow>
          <DetailRow icon="phone">{customer.contactNumber || <span className="text-gray-400">Contact number not set</span>}</DetailRow>
          <DetailRow icon="mail" tone={customer.emailVerified ? 'text-teal-700' : 'text-amber-700'}>
            {customer.emailVerified ? 'Email verified' : 'Email not verified'}
          </DetailRow>
          <DetailRow icon="tag">{discountLine}</DetailRow>
          {formatDate(customer.createdAt) && <DetailRow icon="calendar">Member since {formatDate(customer.createdAt)}</DetailRow>}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full rounded-full bg-teal-700 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
        >
          Book a New Trip
        </button>
        <button
          type="button"
          onClick={() => navigate('/manage-booking')}
          className="w-full rounded-full bg-teal-700 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
        >
          Manage a Booking
        </button>
        <Link
          to="/account/edit"
          className="flex items-center justify-center gap-2 pt-1 text-base font-semibold text-teal-700 hover:underline sm:col-span-2 lg:col-span-1"
        >
          Edit profile details &rarr;
        </Link>
      </div>
    </div>
  )
}


function TipsCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md">
      <img src="/magallanes-port.png" alt="" className="h-36 w-full object-cover" />
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800">Before you sail</h2>
        <ul className="mt-3 space-y-2.5 text-base leading-snug text-gray-600">
          <li>Arrive at the terminal at least 30 minutes before departure.</li>
          <li>Bring a valid government ID matching each passenger.</li>
          <li>Show your reference code at boarding.</li>
        </ul>
        <Link
          to="/directions"
          className="mt-5 block rounded-full border border-teal-700 px-5 py-2.5 text-center text-base font-semibold text-teal-700 transition-colors hover:bg-teal-50"
        >
          Get port directions
        </Link>
      </div>
    </div>
  )
}

function formatCountdown(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}, ${hours} hr${hours === 1 ? '' : 's'}`
  if (hours > 0) return `${hours} hr${hours === 1 ? '' : 's'}, ${minutes} min`
  return `${minutes} min`
}


function NextTripCard({ booking, loading, navigate }) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-7">
        <p className="text-base text-gray-500">Loading your next trip...</p>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-7 text-center">
        <p className="text-lg font-semibold text-gray-800">No upcoming trips</p>
        <p className="mt-1 text-base text-gray-500">When you book a sailing, your next trip will show up here.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 rounded-md bg-teal-700 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-teal-800"
        >
          Book a New Trip
        </button>
      </div>
    )
  }

  const ports = PORT_NAMES[booking.schedule?.direction] || { from: '', to: '' }
  const departure = new Date(booking.schedule.departureDatetime)
  const passengerCount = booking.passengers?.length || 0
  return (
    <div className="rounded-2xl border border-teal-700 bg-white p-5 shadow-md sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Your next trip</p>
        <span className="rounded-full bg-teal-700 px-3 py-1 text-sm font-semibold text-white">
          Departs in {formatCountdown(departure - new Date())}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-gray-800">
        {ports.from} &rarr; {ports.to}
      </p>
      <p className="mt-1 text-lg text-gray-600">
        {departure.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        {' '}at{' '}
        {departure.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4">
        <div className="text-base text-gray-600">
          Reference <span className="font-bold tracking-wide text-gray-800">{booking.referenceCode}</span>
          <span className="mx-2 text-gray-300">|</span>
          {passengerCount} passenger{passengerCount === 1 ? '' : 's'}
        </div>
        <Link
          to={`/manage-booking?reference_code=${encodeURIComponent(booking.referenceCode)}&contact_email=${encodeURIComponent(booking.contactEmail)}`}
          className="rounded-md border border-teal-700 px-5 py-2.5 text-base font-semibold text-teal-700 transition-colors hover:bg-teal-50"
        >
          View details
        </Link>
      </div>
    </div>
  )
}

function StatTile({ label, value, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-4 shadow-md sm:p-5 ${className}`}>
      <p className="text-sm font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold capitalize text-gray-800">{value}</p>
    </div>
  )
}

function DashboardSection({ customer, navigate, bookings, bookingsLoading, nextTrip, upcomingCount }) {
  return (
    <div className="space-y-6">
      <NextTripCard booking={nextTrip} loading={bookingsLoading} navigate={navigate} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Upcoming Trips" value={bookingsLoading ? '-' : upcomingCount} />
        <StatTile label="Total Bookings" value={bookingsLoading ? '-' : bookings.length} />
        <StatTile
          className="col-span-2 sm:col-span-1"
          label="Discount"
          value={
            customer.discountType === 'none'
              ? 'None on file'
              : `${customer.discountType} (${customer.discountStatus.replace('_', ' ')})`
          }
        />
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

  
  const [bookings, setBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState('')
  const [photoUrl, setPhotoUrl] = useState(null)

  useEffect(() => {
    if (!customer) return
    let cancelled = false
    setBookingsLoading(true)
    api.getMyBookings()
      .then((data) => { if (!cancelled) setBookings(data) })
      .catch((err) => { if (!cancelled) setBookingsError(err.message) })
      .finally(() => { if (!cancelled) setBookingsLoading(false) })
    return () => { cancelled = true }

  }, [customer?.id])

  useEffect(() => {
    if (!customer) return
    let cancelled = false
    api.getMyPhotoUrl().then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      setPhotoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    })
    return () => { cancelled = true }

  }, [customer?.id])

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

  const now = new Date()
  const upcomingBookings = bookings
    .filter((b) => b.status === 'confirmed' && b.schedule?.departureDatetime && new Date(b.schedule.departureDatetime) >= now)
    .sort((a, b) => new Date(a.schedule.departureDatetime) - new Date(b.schedule.departureDatetime))
  const nextTrip = upcomingBookings[0] || null

  return (
   
    <div className="relative left-1/2 -mt-28 -ml-[50vw] w-screen">
      <div
        className="relative h-72 bg-cover bg-center sm:h-96 lg:h-[28rem]"
        style={{ backgroundImage: 'url(/hero-6.jpg)' }}
      >
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="relative -mt-20 grid grid-cols-1 sm:-mt-28 items-start gap-6 lg:grid-cols-[270px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_270px]">
          <ProfileSideCard customer={customer} photoUrl={photoUrl} navigate={navigate} />

          <div className="min-w-0 space-y-5">
            {/* Unverified-email notice — separate from Profile Verification
                below. This just confirms the customer controls their inbox;
                it doesn't block login or booking. */}
            {!customer.emailVerified && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-base text-amber-900 shadow-sm">
                <span><strong>Action needed:</strong> Please verify your email address. Check your inbox at {customer.email} for a link.</span>
                <div className="flex flex-shrink-0 items-center gap-3">
                  {resendMessage && <span className="text-sm text-amber-800">{resendMessage}</span>}
                  <button
                    onClick={handleResendVerification}
                    disabled={resendingVerification}
                    className="whitespace-nowrap rounded-full border border-amber-700 bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    {resendingVerification ? 'Sending...' : 'Resend Email'}
                  </button>
                </div>
              </div>
            )}

            {/* Not-verified notice — only shown when there's something to act
                on (never verified, or a previous submission expired or was
                rejected). Silent for 'pending' and 'verified'. */}
            {['none', 'rejected', 'expired'].includes(customer.discountStatus) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-base text-amber-900 shadow-sm">
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
                  className="flex-shrink-0 whitespace-nowrap rounded-full border border-amber-700 bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
                >
                  Verify Now
                </button>
              </div>
            )}

            <AccountTabs activeTab={activeTab} onSelect={setActiveTab} upcomingCount={upcomingBookings.length} />

            {activeTab === 'dashboard' && (
              <DashboardSection
                customer={customer}
                navigate={navigate}
                bookings={bookings}
                bookingsLoading={bookingsLoading}
                nextTrip={nextTrip}
                upcomingCount={upcomingBookings.length}
              />
            )}
            {activeTab === 'profile' && <ProfileCard customer={customer} />}
            {activeTab === 'bookings' && (
              <BookingHistoryCard bookings={bookings} loading={bookingsLoading} error={bookingsError} />
            )}
            {activeTab === 'verification' && (
              <ProfileVerificationCard customer={customer} onUpdated={handleVerificationUpdated} />
            )}
          </div>

          <div className="min-w-0 lg:col-start-2 xl:col-start-3">
            <TipsCard />
          </div>
        </div>
      </div>
    </div>
  )
}
