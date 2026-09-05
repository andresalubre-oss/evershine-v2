import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Search from './pages/Search.jsx'
import SearchResults from './pages/SearchResults.jsx'
import Booking from './pages/Booking.jsx'
import ManageBooking from './pages/ManageBooking.jsx'
import Directions from './pages/Directions.jsx'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'
import ManifestPrint from './pages/ManifestPrint.jsx'
import Register from './pages/Register.jsx'
import CustomerLogin from './pages/CustomerLogin.jsx'
import Account from './pages/Account.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import Policies from './pages/Policies.jsx'
import TicketPolicies from './pages/TicketPolicies.jsx'
import FAQs from './pages/FAQs.jsx'
import RefundCancellation from './pages/RefundCancellation.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsConditions from './pages/TermsConditions.jsx'

export default function App() {
  return (
    <Routes>
      {/* Standalone — no top nav/footer/sidebar chrome, since this is a printable
          document opened in its own tab from the admin Manifest tab. */}
      <Route path="/admin/manifest-print" element={<ManifestPrint />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Search />} />
        <Route path="/search-results" element={<SearchResults />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/manage-booking" element={<ManageBooking />} />
        <Route path="/directions" element={<Directions />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account/login" element={<CustomerLogin />} />
        <Route path="/account" element={<Account />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/travel-info/policies" element={<Policies />} />
        <Route path="/travel-info/ticket-policies" element={<TicketPolicies />} />
        <Route path="/travel-info/faqs" element={<FAQs />} />
        <Route path="/refund-cancellation" element={<RefundCancellation />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
      </Route>
    </Routes>
  )
}
