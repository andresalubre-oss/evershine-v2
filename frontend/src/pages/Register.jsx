// Save as: frontend/src/pages/Register.jsx

import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

function IconEye(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconEyeOff(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.6 5.1A9.9 9.9 0 0112 5c6 0 9.5 7 9.5 7a15.8 15.8 0 01-3.1 4.1M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 7 9.5 7a9.4 9.4 0 004.4-1.1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 9.9a3 3 0 004.2 4.2" />
    </svg>
  )
}
function IconAlert(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.5h18a1 1 0 00.89-1.46L13.71 3.86a1 1 0 00-1.72 0z" />
    </svg>
  )
}
function IconSpinner(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

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

// Numbered badge + heading, used at the top of each form section so a long
// form reads as a sequence of small steps instead of one undifferentiated
// wall of fields — same numbered-circle pattern as the "How It Works"
// section on the landing page, reused here for visual consistency.
function SectionHeading({ number, title, hint }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
        {number}
      </span>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  )
}

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2'

// Official Philippine Standard Geographic Code API (PSA data, free, no key
// required) — used to back the Region/Province/Municipality-City/Barangay
// dropdowns so addresses match real administrative divisions instead of
// however each person happens to spell/abbreviate them.
const PSGC_BASE = 'https://psgc.gitlab.io/api'
// NCR has no provinces in PSGC — cities/municipalities sit directly under
// the region, so it needs a special case in the cascade below.
const NCR_REGION_CODE = '130000000'

// A text input that behaves like a normal, freely-typeable field (so an
// address that isn't in the list can still be entered and submitted) while
// also showing a filtered dropdown of matching official names underneath —
// picking one fills the field and, for Region/Province/Municipality-City,
// loads the next field's options.
function AddressCombobox({ label, required, value, onChange, onSelect, options, loading, loadError, emptyHint }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const query = value.trim().toLowerCase()
  const filtered = query ? options.filter((o) => o.name.toLowerCase().includes(query)) : options
  const shown = filtered.slice(0, 50)

  return (
    <Field label={label} required={required}>
      <div ref={wrapperRef} className="relative">
        <input
          type="text"
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          className={inputClass}
        />
        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
            {loading ? (
              <p className="px-3 py-2 text-sm text-gray-400">Loading...</p>
            ) : loadError ? (
              <p className="px-3 py-2 text-sm text-gray-400">Couldn't load suggestions — you can still type this in yourself.</p>
            ) : shown.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">{emptyHint || 'No matches — you can still type your own.'}</p>
            ) : (
              shown.map((o) => (
                <button
                  type="button"
                  key={o.code}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelect(o)
                    setOpen(false)
                  }}
                  className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-teal-50"
                >
                  {o.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </Field>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')

  const [region, setRegion] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [province, setProvince] = useState('')
  const [cityMunicipality, setCityMunicipality] = useState('')
  const [cityCode, setCityCode] = useState('')
  const [barangay, setBarangay] = useState('')
  const [zipCode, setZipCode] = useState('')

  const [regions, setRegions] = useState([])
  const [regionsError, setRegionsError] = useState(false)
  const [provinces, setProvinces] = useState([])
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [provincesError, setProvincesError] = useState(false)
  const [cities, setCities] = useState([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [citiesError, setCitiesError] = useState(false)
  const [barangays, setBarangays] = useState([])
  const [loadingBarangays, setLoadingBarangays] = useState(false)
  const [barangaysError, setBarangaysError] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [contactNumber, setContactNumber] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${PSGC_BASE}/regions/`)
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setRegions(data) })
      .catch(() => { if (!cancelled) setRegionsError(true) })
    return () => { cancelled = true }
  }, [])

  async function loadProvinces(code) {
    setLoadingProvinces(true)
    setProvincesError(false)
    try {
      const res = await fetch(`${PSGC_BASE}/regions/${code}/provinces/`)
      const data = await res.json()
      setProvinces(data)
    } catch {
      setProvincesError(true)
    } finally {
      setLoadingProvinces(false)
    }
  }

  async function loadCities(code, { byRegion } = {}) {
    setLoadingCities(true)
    setCitiesError(false)
    try {
      const res = await fetch(
        byRegion ? `${PSGC_BASE}/regions/${code}/cities-municipalities/` : `${PSGC_BASE}/provinces/${code}/cities-municipalities/`
      )
      const data = await res.json()
      setCities(data)
    } catch {
      setCitiesError(true)
    } finally {
      setLoadingCities(false)
    }
  }

  async function loadBarangays(code) {
    setLoadingBarangays(true)
    setBarangaysError(false)
    try {
      const res = await fetch(`${PSGC_BASE}/cities-municipalities/${code}/barangays/`)
      const data = await res.json()
      setBarangays(data)
    } catch {
      setBarangaysError(true)
    } finally {
      setLoadingBarangays(false)
    }
  }

  function resetBelowRegion() {
    setProvince('')
    setProvinces([])
    setCityMunicipality('')
    setCityCode('')
    setCities([])
    setBarangay('')
    setBarangays([])
  }

  function resetBelowProvince() {
    setCityMunicipality('')
    setCityCode('')
    setCities([])
    setBarangay('')
    setBarangays([])
  }

  function resetBelowCity() {
    setBarangay('')
    setBarangays([])
  }

  function handleRegionChange(text) {
    setRegion(text)
    setRegionCode('')
    resetBelowRegion()
  }

  function handleRegionSelect(o) {
    setRegion(o.name)
    setRegionCode(o.code)
    resetBelowRegion()
    if (o.code === NCR_REGION_CODE) {
      setProvince('Metro Manila')
      loadCities(o.code, { byRegion: true })
    } else {
      loadProvinces(o.code)
    }
  }

  function handleProvinceChange(text) {
    setProvince(text)
    resetBelowProvince()
  }

  function handleProvinceSelect(o) {
    setProvince(o.name)
    resetBelowProvince()
    loadCities(o.code)
  }

  function handleCityChange(text) {
    setCityMunicipality(text)
    setCityCode('')
    resetBelowCity()
  }

  function handleCitySelect(o) {
    setCityMunicipality(o.name)
    setCityCode(o.code)
    resetBelowCity()
    loadBarangays(o.code)
  }

  function handleBarangayChange(text) {
    setBarangay(text)
  }

  function handleBarangaySelect(o) {
    setBarangay(o.name)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
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

  const confirmPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const confirmPasswordMatches = confirmPassword.length > 0 && password === confirmPassword

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
          <SectionHeading number={1} title="Personal Information" />
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First Name" required>
              <input type="text" required placeholder="Juan" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Last Name" required>
              <input type="text" required placeholder="Dela Cruz" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Middle Name">
              <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Suffix">
              <input type="text" placeholder="Jr., III" value={suffix} onChange={(e) => setSuffix(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </section>

        {/* Address */}
        <section>
          <SectionHeading
            number={2}
            title="Address"
            hint="Start typing to see suggestions from official PSA data — or type your own if it's not listed."
          />

          <div className="mt-3 space-y-4">
            <AddressCombobox
              label="Region"
              required
              value={region}
              onChange={handleRegionChange}
              onSelect={handleRegionSelect}
              options={regions}
              loadError={regionsError}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AddressCombobox
                label="Province"
                required
                value={province}
                onChange={handleProvinceChange}
                onSelect={handleProvinceSelect}
                options={provinces}
                loading={loadingProvinces}
                loadError={provincesError}
                emptyHint={regionCode ? 'No matches.' : 'Select a Region first, or type your own.'}
              />
              <AddressCombobox
                label="Municipality/City"
                required
                value={cityMunicipality}
                onChange={handleCityChange}
                onSelect={handleCitySelect}
                options={cities}
                loading={loadingCities}
                loadError={citiesError}
                emptyHint={province ? 'No matches.' : 'Select a Province first, or type your own.'}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AddressCombobox
                label="Barangay"
                required
                value={barangay}
                onChange={handleBarangayChange}
                onSelect={handleBarangaySelect}
                options={barangays}
                loading={loadingBarangays}
                loadError={barangaysError}
                emptyHint={cityCode ? 'No matches.' : 'Select a Municipality/City first, or type your own.'}
              />
              <Field label="Zip Code" required>
                <input type="text" required placeholder="6600" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputClass} />
              </Field>
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <SectionHeading number={3} title="Account" />
          <div className="mt-3 space-y-4">
            <Field label="Phone Number" required>
              <input type="text" required placeholder="09171234567" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Email" required>
              <input type="email" required placeholder="juan.delacruz@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Password" required>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">At least 8 characters.</p>
            </Field>
            <Field label="Confirm Password" required>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPasswordMismatch && <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>}
              {confirmPasswordMatches && <p className="mt-1 text-xs text-green-600">Passwords match.</p>}
            </Field>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <IconAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <IconSpinner className="h-4 w-4 animate-spin" />}
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">
            Your address and ID details are used only to verify discount eligibility — never shared or sold.
          </p>
        </div>

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