import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../api.js'

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
    discountFile: null,
  }
}

export default function Booking() {
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get('schedule_id')
  const fare = searchParams.get('fare')
  const datetime = searchParams.get('datetime')
  const direction = searchParams.get('direction') === 'LIMASAWA_TO_PB' ? 'LIMASAWA_TO_PB' : 'PB_TO_LIMASAWA'

  const [contactEmail, setContactEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [passengers, setPassengers] = useState([emptyPassenger()])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [booking, setBooking] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadError, setUploadError] = useState(false)

  const [qrCodeImageUrl, setQrCodeImageUrl] = useState(null)
  const [testUrl, setTestUrl] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('idle') // idle | loading | awaiting_payment | paid | expired | error
  const [paymentError, setPaymentError] = useState('')

  function updatePassengerCount(count) {
    const num = Math.max(1, Math.min(10, count))
    setPassengers((prev) => {
      const next = [...prev]
      while (next.length < num) next.push(emptyPassenger())
      next.length = num
      return next
    })
  }

  function updatePassenger(index, field, value) {
    setPassengers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    )
  }

  async function submitBooking() {
    setError('')
    if (!contactEmail || passengers.some((p) => !p.first_name || !p.last_name)) {
      setError("Please fill in your email and every passenger's first and last name.")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        schedule_id: scheduleId,
        contact_email: contactEmail,
        contact_number: contactNumber,
        passengers: passengers.map(({ discountFile, ...p }) => p),
      }
      const data = await api.createBooking(payload)
      const createdBooking = data.booking

      // Upload discount IDs for any passenger who selected a discount and a file.
      // Correlated by array position (booking + its passengers are created in
      // one request, in the order submitted).
      await Promise.all(
        passengers.map(async (p, i) => {
          if (p.discount_type !== 'none' && p.discountFile) {
            const returnedPassenger = createdBooking.passengers[i]
            const formData = new FormData()
            formData.append('reference_code', createdBooking.referenceCode)
            formData.append('contact_email', contactEmail)
            formData.append('discount_id', p.discountFile)
            await api.uploadDiscountId(returnedPassenger.id, formData)
          }
        })
      )

      setBooking(createdBooking)
    } catch (err) {
      setError(err.message)
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

  async function submitReceipt() {
    setUploadMessage('')
    setUploadError(false)
    if (!receiptFile) {
      setUploadMessage('Choose an image file first.')
      setUploadError(true)
      return
    }
    const formData = new FormData()
    formData.append('reference_code', booking.referenceCode)
    formData.append('contact_email', contactEmail)
    formData.append('receipt', receiptFile)

    try {
      await api.uploadReceipt(formData)
      setUploadMessage('Receipt uploaded! Awaiting admin approval.')
      setUploadError(false)
    } catch (err) {
      setUploadMessage(err.message)
      setUploadError(true)
    }
  }

  if (!scheduleId) {
    return <p className="text-red-600">No trip selected. Go back and search again.</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800">Book Your Trip</h1>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-bold text-gray-800">{new Date(datetime).toLocaleString()}</p>
        <p className="text-teal-700 font-bold">Base Fare: &#8369;{fare}</p>
      </div>

      {!booking && (
        <>
          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">Contact Details</h2>
            <label className="mt-3 block text-sm font-medium text-gray-700">Your Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
            <label className="mt-3 block text-sm font-medium text-gray-700">Your Contact Number</label>
            <input
              type="text"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">Passengers</h2>
            <label className="mt-3 block text-sm font-medium text-gray-700">Number of Passengers</label>
            <input
              type="number"
              min="1"
              max="10"
              value={passengers.length}
              onChange={(e) => updatePassengerCount(parseInt(e.target.value) || 1)}
              className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2"
            />

            {passengers.map((p, i) => (
              <div key={i} className="mt-5 border-t border-gray-100 pt-4">
                <h3 className="font-semibold text-gray-700">Passenger {i + 1}</h3>

                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-gray-600">First Name</label>
                    <input type="text" value={p.first_name}
                      onChange={(e) => updatePassenger(i, 'first_name', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Middle Name (optional)</label>
                    <input type="text" value={p.middle_name}
                      onChange={(e) => updatePassenger(i, 'middle_name', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Last Name</label>
                    <input type="text" value={p.last_name}
                      onChange={(e) => updatePassenger(i, 'last_name', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Suffix (optional)</label>
                    <input type="text" placeholder="Jr., Sr., III" value={p.suffix}
                      onChange={(e) => updatePassenger(i, 'suffix', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Sex</label>
                    <select value={p.sex} onChange={(e) => updatePassenger(i, 'sex', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Nationality</label>
                    <input type="text" value={p.nationality}
                      onChange={(e) => updatePassenger(i, 'nationality', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                </div>

                <h4 className="mt-4 text-sm font-semibold text-gray-700">Address</h4>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-gray-600">Barangay</label>
                    <input type="text" value={p.barangay}
                      onChange={(e) => updatePassenger(i, 'barangay', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">City/Municipality</label>
                    <input type="text" value={p.city_municipality}
                      onChange={(e) => updatePassenger(i, 'city_municipality', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Province</label>
                    <input type="text" value={p.province}
                      onChange={(e) => updatePassenger(i, 'province', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Zip Code</label>
                    <input type="text" value={p.zip_code}
                      onChange={(e) => updatePassenger(i, 'zip_code', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Country</label>
                    <input type="text" value={p.country}
                      onChange={(e) => updatePassenger(i, 'country', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                </div>

                <h4 className="mt-4 text-sm font-semibold text-gray-700">Contact & Discount</h4>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm text-gray-600">Email</label>
                    <input type="email" value={p.email}
                      onChange={(e) => updatePassenger(i, 'email', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Contact Number</label>
                    <input type="text" value={p.contact_number}
                      onChange={(e) => updatePassenger(i, 'contact_number', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Discount Type</label>
                    <select value={p.discount_type} onChange={(e) => updatePassenger(i, 'discount_type', e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
                      <option value="none">None</option>
                      <option value="senior">Senior Citizen</option>
                      <option value="pwd">PWD</option>
                      <option value="student">Student</option>
                    </select>
                  </div>
                  {p.discount_type !== 'none' && (
                    <div>
                      <label className="block text-sm text-gray-600">Upload Valid ID</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => updatePassenger(i, 'discountFile', e.target.files[0])}
                        className="mt-1 w-full text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            onClick={submitBooking}
            disabled={submitting}
            className="mt-6 rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </>
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

          {paymentStatus !== 'paid' && (
            <details className="mt-6 text-left">
              <summary className="cursor-pointer text-sm text-teal-700">
                Paid another way? Upload a receipt instead
              </summary>
              <div className="mt-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files[0])}
                />
                <div>
                  <button
                    onClick={submitReceipt}
                    className="mt-3 rounded-md bg-gray-600 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700"
                  >
                    Upload Receipt
                  </button>
                </div>
                {uploadMessage && (
                  <p className={`mt-3 text-sm ${uploadError ? 'text-red-600' : 'text-teal-700'}`}>
                    {uploadMessage}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
