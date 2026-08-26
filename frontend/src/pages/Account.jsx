// Save as: frontend/src/pages/Account.jsx

import { useState, useEffect, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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

function initialsOf(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0].toUpperCase()).join('') || '?'
}

// --- Icons (simple, dependency-free inline SVGs — same approach as Admin.jsx) --

function IconCompass(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5l-2.2 5.2-5.2 2.2 2.2-5.2z" />
    </svg>
  )
}
function IconSearch(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  )
}
function IconUser(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 21c1.5-4.5 5-6 8-6s6.5 1.5 8 6" />
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
function IconTicket(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" />
      <path strokeLinecap="round" d="M14 6v12" strokeDasharray="2 3" />
    </svg>
  )
}
function IconUpload(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  )
}
function IconImage(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 16l-5.5-5.5a1.5 1.5 0 00-2.12 0L4 19" />
    </svg>
  )
}
function IconX(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
function IconAlertTriangle(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.9L1.9 18a1.5 1.5 0 001.3 2.3h17.6a1.5 1.5 0 001.3-2.3L13.7 3.9a1.5 1.5 0 00-2.6 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 16.5v.01" />
    </svg>
  )
}
function IconCamera(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8a2 2 0 012-2h1.5l1-1.5h7l1 1.5H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
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
      <div className="mt-1.5 overflow-hidden rounded-md border border-gray-200">
        <img src={previewUrl} alt="Captured selfie" className="aspect-[4/3] w-full object-cover" />
        <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
          <span className="text-xs font-medium text-teal-700">Selfie captured</span>
          <button type="button" onClick={retake} className="text-xs font-medium text-gray-600 hover:underline">
            Retake
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-1.5 overflow-hidden rounded-md border-2 border-dashed border-gray-300">
      {active ? (
        <div className="relative bg-black">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full scale-x-[-1] object-cover" />
          <button
            type="button"
            onClick={capture}
            className="absolute inset-x-0 bottom-3 mx-auto flex w-max items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-lg hover:bg-gray-100"
          >
            <span className="h-3 w-3 rounded-full bg-red-600" /> Capture
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCamera}
          className="flex w-full flex-col items-center justify-center gap-1.5 px-4 py-6 text-center transition-colors hover:border-teal-400 hover:bg-teal-50/40"
        >
          <IconCamera className="h-6 w-6 text-gray-400" />
          <span className="text-sm font-medium text-teal-700">Turn on camera to take a live selfie</span>
          <span className="text-xs text-gray-400">Required for verification — camera only, no gallery uploads</span>
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {error && <p className="px-3 pb-3 pt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// Small heading treatment reused across every card so the page reads as one
// coherent system instead of five differently-styled boxes.
function CardHeading({ icon: Icon, accent = 'teal', children, action }) {
  const styles = {
    teal: 'bg-teal-50 text-teal-700',
    purple: 'bg-purple-50 text-purple-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${styles[accent]}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h2 className="text-base font-semibold text-gray-800">{children}</h2>
      </div>
      {action}
    </div>
  )
}

// Editable name/contact number — email stays fixed since it's the login identifier.
function ProfileCard({ customer, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(customer.name)
  const [contactNumber, setContactNumber] = useState(customer.contactNumber || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEditing() {
    setName(customer.name)
    setContactNumber(customer.contactNumber || '')
    setError('')
    setEditing(true)
  }

  async function save() {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await api.updateProfile({ name: name.trim(), contact_number: contactNumber.trim() })
      await onSaved()
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <CardHeading
        icon={IconUser}
        action={
          !editing && (
            <button onClick={startEditing} className="text-sm font-semibold text-teal-700 hover:underline">
              Edit
            </button>
          )
        }
      >
        Profile
      </CardHeading>

      {editing ? (
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Contact Number</label>
            <input
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. 0917 123 4567"
              className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm"
            />
          </div>
          <p className="text-xs text-gray-400">Email ({customer.email}) can't be changed here.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Name</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800">{customer.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800">{customer.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Contact</p>
            <p className="mt-0.5 text-sm font-medium text-gray-800">
              {customer.contactNumber || <span className="font-normal text-gray-400">Not set</span>}
            </p>
          </div>
        </div>
      )}
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
        <div className="mt-1.5 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <IconImage className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gray-300 px-4 py-6 text-center transition-colors hover:border-teal-400 hover:bg-teal-50/40">
          <IconUpload className="h-6 w-6 text-gray-400" />
          <span className="text-sm font-medium text-teal-700">Click to upload {label.toLowerCase()}</span>
          <span className="text-xs text-gray-400">JPG or PNG</span>
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
    <div id="profile-verification" className="scroll-mt-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <CardHeading icon={IconTag} accent="purple">
        Profile Verification
      </CardHeading>

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
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <CardHeading icon={IconTicket} accent="blue">
        My Bookings
      </CardHeading>

      {loading && <p className="mt-5 text-sm text-gray-500">Loading your bookings...</p>}
      {error && <p className="mt-5 text-sm text-red-600">{error}</p>}

      {!loading && !error && bookings.length === 0 && (
        <div className="mt-5 flex flex-col items-center rounded-lg border border-dashed border-gray-200 py-10 text-center">
          <IconTicket className="h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">No bookings yet under this account.</p>
          <p className="mt-1 text-xs text-gray-400">Bookings you make while logged in will show up here.</p>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <div className="mt-5 space-y-3">
          {bookings.map((b) => {
            const ports = PORT_NAMES[b.schedule?.direction] || { from: '', to: '' }
            return (
              <div key={b.id} className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-teal-200 hover:bg-teal-50/30">
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Account() {
  const { customer, loading, logout, refreshMe } = useAuth()
  const navigate = useNavigate()

  // The live selfie from Profile Verification doubles as the account's
  // permanent profile photo. Fetched separately from `customer` (it's a
  // file, not a JSON field) and re-fetched after a new verification is
  // submitted, so a fresh photo replaces the old one right away. Hooks must
  // run unconditionally on every render, so this — and its effect — sits
  // above the `loading`/`!customer` early returns below, guarding on
  // `customer` internally instead of being skipped by them.
  const [photoUrl, setPhotoUrl] = useState(null)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

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

  async function reloadPhoto() {
    const url = await api.getMyPhotoUrl()
    setPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
  }

  useEffect(() => {
    if (!customer) return
    let cancelled = false
    api.getMyPhotoUrl().then((url) => { if (!cancelled) setPhotoUrl(url) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id])

  if (loading) return <p className="text-gray-500">Loading...</p>
  if (!customer) return <Navigate to="/account/login" replace />

  function handleLogout() {
    logout()
    navigate('/')
  }

  async function handleVerificationUpdated() {
    await refreshMe()
    await reloadPhoto()
  }

  return (
    <div>
      {/* Hero banner — gives the dashboard a real visual anchor instead of
          starting straight into gray boxes. */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-teal-700 to-teal-600 p-6 text-white shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Your profile photo"
              className="h-14 w-14 flex-shrink-0 rounded-full object-cover ring-2 ring-white/30"
            />
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold ring-2 ring-white/30">
              {initialsOf(customer.name)}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Welcome back, {customer.name.split(' ')[0]}</h1>
            <p className="text-sm text-teal-50">{customer.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-white/40 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          Log out
        </button>
      </div>

      {/* Unverified-email notice — separate from Profile Verification below.
          This just confirms the customer controls their inbox; it doesn't
          block login or booking. */}
      {!customer.emailVerified && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2.5">
            <IconAlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <span>Please verify your email address. Check your inbox at {customer.email} for a link.</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {resendMessage && <span className="text-xs text-amber-700">{resendMessage}</span>}
            <button
              onClick={handleResendVerification}
              disabled={resendingVerification}
              className="whitespace-nowrap rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {resendingVerification ? 'Sending...' : 'Resend Email'}
            </button>
          </div>
        </div>
      )}

      {/* Not-verified notice — only shown when there's something to act on
          (never verified, or a previous submission expired/was rejected).
          Silent for 'pending' (already submitted, nothing to do) and
          'verified' (nothing to warn about). */}
      {['none', 'rejected', 'expired'].includes(customer.discountStatus) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2.5">
            <IconAlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <span>
              {customer.discountStatus === 'rejected'
                ? "Your Profile Verification wasn't approved. Submit again to become eligible for a discount."
                : customer.discountStatus === 'expired'
                ? 'Your Profile Verification has expired. Renew it to keep your discount eligibility.'
                : "Your profile isn't verified yet. Verify it to unlock Senior, PWD, or Student discounts."}
            </span>
          </div>
          <a
            href="#profile-verification"
            className="flex-shrink-0 whitespace-nowrap rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Verify Now
          </a>
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-4 rounded-xl border border-teal-200 bg-teal-50 p-5 text-left transition-colors hover:bg-teal-100"
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
            <IconCompass className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-teal-800">Book a New Trip</p>
            <p className="text-xs text-teal-700">Search sailings to Limasawa or Padre Burgos</p>
          </div>
          <span className="ml-auto text-lg text-teal-600">&rarr;</span>
        </button>
        <button
          onClick={() => navigate('/manage-booking')}
          className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors hover:bg-gray-50"
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
            <IconSearch className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800">Manage a Booking</p>
            <p className="text-xs text-gray-500">Look up any booking by reference code</p>
          </div>
          <span className="ml-auto text-lg text-gray-400">&rarr;</span>
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <ProfileCard customer={customer} onSaved={refreshMe} />
          <ProfileVerificationCard customer={customer} onUpdated={handleVerificationUpdated} />
        </div>
        <div className="lg:col-span-2">
          <BookingHistoryCard />
        </div>
      </div>
    </div>
  )
}
