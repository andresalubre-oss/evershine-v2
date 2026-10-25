import { useEffect, Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Search from './pages/Search.jsx'
import SearchResults from './pages/SearchResults.jsx'
import Booking from './pages/Booking.jsx'
import GuestVerifyEmail from './pages/GuestVerifyEmail.jsx'
import ManageBooking from './pages/ManageBooking.jsx'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'
import CoastGuardPortal from './pages/CoastGuardPortal.jsx'
import ManifestPrint from './pages/ManifestPrint.jsx'
import Register from './pages/Register.jsx'
import CustomerLogin from './pages/CustomerLogin.jsx'
import Account from './pages/Account.jsx'
import EditProfile from './pages/EditProfile.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Policies from './pages/Policies.jsx'
import TicketPolicies from './pages/TicketPolicies.jsx'
import FAQs from './pages/FAQs.jsx'
import RefundCancellation from './pages/RefundCancellation.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsConditions from './pages/TermsConditions.jsx'
import CookiePolicy from './pages/CookiePolicy.jsx'
import ContactUs from './pages/ContactUs.jsx'
import DevelopersPage from "./pages/DevelopersPage";


const Directions = lazy(() => import('./pages/Directions.jsx'))


function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
 
      <Route path="/admin/manifest-print" element={<ManifestPrint />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Search />} />
        <Route path="/search-results" element={<SearchResults />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/booking/verify-guest-email" element={<GuestVerifyEmail />} />
        <Route path="/manage-booking" element={<ManageBooking />} />
        <Route
          path="/directions"
          element={
            <Suspense fallback={<p className="text-sm text-gray-500">Loading map...</p>}>
              <Directions />
            </Suspense>
          }
        />
        <Route path="/admin" element={<Login />} />
        <Route path="/admin/dashboard" element={<Admin />} />
        <Route path="/coastguard" element={<CoastGuardPortal />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account/login" element={<CustomerLogin />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/edit" element={<EditProfile />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/travel-info/policies" element={<Policies />} />
        <Route path="/travel-info/ticket-policies" element={<TicketPolicies />} />
        <Route path="/travel-info/faqs" element={<FAQs />} />
        <Route path="/refund-cancellation" element={<RefundCancellation />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/developers-page" element={<DevelopersPage />} />
      </Route>
      </Routes>
    </>
  )
}
