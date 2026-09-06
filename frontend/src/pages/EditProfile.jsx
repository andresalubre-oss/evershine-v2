// Save as: frontend/src/pages/EditProfile.jsx
//
// Dedicated page for editing the customer's own profile (name, contact
// number, address) — split out from Account.jsx so the full form has room
// to breathe instead of being squeezed into a small dashboard card.

import { useState, useEffect, useRef } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

// Official Philippine Standard Geographic Code API (PSA data, free, no key
// required) — same source used on Register.jsx, so an existing customer
// editing their profile gets the same searchable Region/Province/
// City-Municipality/Barangay suggestions they saw at signup.
const PSGC_BASE = 'https://psgc.gitlab.io/api'
// NCR has no provinces in PSGC — cities/municipalities sit directly under
// the region, so it needs a special case in the cascade below.
const NCR_REGION_CODE = '130000000'

function Required() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {' '}*
    </span>
  )
}

// A text input that behaves like a normal, freely-typeable field (so an
// address that isn't in the list can still be entered and submitted) while
// also showing a filtered dropdown of matching official names underneath —
// picking one fills the field and, for Region/Province/City-Municipality,
// loads the next field's options. Same pattern as Register.jsx.
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
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <Required />}
      </label>
      <div ref={wrapperRef} className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {open && (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-gray-300 bg-white">
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
    </div>
  )
}

export default function EditProfile() {
  const { customer, loading, refreshMe } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [contactNumber, setContactNumber] = useState('')

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

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Seeds the form from the account once it's loaded — hooks have to run on
  // every render regardless of whether `customer` is ready yet, so this
  // can't just be inline useState initializers the way a normal form would.
  const seededRef = useRef(false)
  useEffect(() => {
    if (!customer || seededRef.current) return
    seededRef.current = true
    setFirstName(customer.firstName || '')
    setMiddleName(customer.middleName || '')
    setLastName(customer.lastName || '')
    setSuffix(customer.suffix || '')
    setContactNumber(customer.contactNumber || '')
    setRegion(customer.region || '')
    setProvince(customer.province || '')
    setCityMunicipality(customer.cityMunicipality || '')
    setBarangay(customer.barangay || '')
    setZipCode(customer.zipCode || '')
  }, [customer])

  // Regions are fetched once when the page opens — this page exists only to
  // edit, so there's no "viewing" state where the fetch would be wasted.
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
      setProvinces(await res.json())
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
      setCities(await res.json())
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
      setBarangays(await res.json())
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
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    if (!region.trim() || !province.trim() || !cityMunicipality.trim() || !barangay.trim() || !zipCode.trim()) {
      setError('Please complete your full address.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await api.updateProfile({
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        suffix: suffix.trim(),
        barangay: barangay.trim(),
        city_municipality: cityMunicipality.trim(),
        province: province.trim(),
        zip_code: zipCode.trim(),
        region: region.trim(),
        contact_number: contactNumber.trim(),
      })
      await refreshMe()
      navigate('/account')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>
  if (!customer) return <Navigate to="/account/login" replace />

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/account" className="text-sm font-medium text-teal-700 hover:underline">
        &larr; Back to Account
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-800">Edit Profile</h1>
      <p className="mt-1 text-sm text-gray-600">Update your name, contact number, or address.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-8 rounded-lg border border-gray-200 bg-white p-6 sm:p-8">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Personal Information</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                First Name<Required />
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Last Name<Required />
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Middle Name <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Suffix <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="e.g. Jr., III"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Contact Number</h2>
          <div className="mt-3">
            <input
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. 09171234567"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Address</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Start typing to see suggestions from official PSA data — or type your own if it's not listed.
          </p>
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
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Zip Code<Required />
                </label>
                <input
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="e.g. 6600"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
          </div>
        </section>

        <p className="text-xs text-gray-500">Email ({customer.email}) can't be changed here.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
