// Save as: frontend/src/pages/Register.jsx

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label} {required ? <span className="text-red-500">*</span> : <span className="font-normal text-gray-400">(optional)</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')

  const [barangay, setBarangay] = useState('')
  const [cityMunicipality, setCityMunicipality] = useState('')
  const [province, setProvince] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [region, setRegion] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [contactNumber, setContactNumber] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    try {
      const data = await api.register({
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix,
        barangay,
        city_municipality: cityMunicipality,
        province,
        zip_code: zipCode,
        region,
        email,
        password,
        contact_number: contactNumber,
      })
      login(data.token, data.customer)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">Create an Account</h1>
      <p className="mt-1 text-sm text-gray-600">
        Register to avail Senior, PWD, or Student discounts once your ID is verified.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
      >
        {/* Personal Information */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Personal Information</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First Name" required>
              <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Last Name" required>
              <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Middle Name">
              <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Suffix">
              <input type="text" placeholder="e.g. Jr., III" value={suffix} onChange={(e) => setSuffix(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </section>

        {/* Address */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Address</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Barangay" required>
              <input type="text" required value={barangay} onChange={(e) => setBarangay(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Municipality/City" required>
              <input type="text" required value={cityMunicipality} onChange={(e) => setCityMunicipality(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Province" required>
              <input type="text" required value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Zip Code" required>
              <input type="text" required value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Region" required>
                <input type="text" required value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} />
              </Field>
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Account</h2>
          <div className="mt-3 space-y-4">
            <Field label="Email" required>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Phone Number" required>
              <input type="text" required value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Password" required>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
            </Field>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/account/login" className="text-teal-700 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
