import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Search from './pages/Search.jsx'
import Booking from './pages/Booking.jsx'
import ManageBooking from './pages/ManageBooking.jsx'
import Directions from './pages/Directions.jsx'
import Login from './pages/Login.jsx'
import Admin from './pages/Admin.jsx'
import Register from './pages/Register.jsx'
import CustomerLogin from './pages/CustomerLogin.jsx'
import Account from './pages/Account.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Search />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/manage-booking" element={<ManageBooking />} />
        <Route path="/directions" element={<Directions />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account/login" element={<CustomerLogin />} />
        <Route path="/account" element={<Account />} />
      </Route>
    </Routes>
  )
}
