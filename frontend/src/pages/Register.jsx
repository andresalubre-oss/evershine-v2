// Save as: frontend/src/pages/Register.jsx

import { useState, useEffect, useRef } from 'react'
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

  // Address — Region/Province/Municipality-City/Barangay cascade top-down
  // (broad to narrow), matching how the PSGC API structures lookups. Each
  // field stores the plain text that actually gets submitted; the "*Code"
  // companions are only kept around to know which PSGC list to fetch next
  // and aren't sent to the backend.
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
      // NCR has no provinces — skip straight to its cities/municipalities,
      // and just label the province field for the person instead of
      // pretending there's a real province to pick.
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

        {/* Address — Region first, then Province, then Municipality/City,
            then Barangay, each narrowing the next field's suggestions.
            Zip Code stays a plain field: PH zip codes aren't reliably
            one-to-one with a city/municipality (large cities like Quezon
            City span dozens of codes), so auto-filling it would often be
            wrong — better to have the person enter the one printed on
            their own mail/ID. */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Address</h2>

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
                <input type="text" required value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputClass} />
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
