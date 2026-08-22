// Save as: frontend/src/context/AuthContext.jsx
//
// Wraps the app and tracks whether a customer is logged in. Any component
// can call useAuth() to read the current customer or trigger login/logout.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    const token = localStorage.getItem('customerToken')
    if (!token) {
      setCustomer(null)
      setLoading(false)
      return
    }
    try {
      const data = await api.getCustomerMe()
      setCustomer(data.customer)
    } catch {
      // token missing/expired/invalid — fall back to logged-out
      localStorage.removeItem('customerToken')
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshMe()
  }, [refreshMe])

  function login(token, customerData) {
    localStorage.setItem('customerToken', token)
    setCustomer(customerData)
  }

  function logout() {
    localStorage.removeItem('customerToken')
    setCustomer(null)
  }

  return (
    <AuthContext.Provider value={{ customer, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
