import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, setAccessTokenProvider } from '../lib/api'
import { StaffAuthContext } from './staffAuth'
import { clearStaffSession, readStaffSession, saveStaffSession } from './staffSession'

export function StaffAuthProvider({ children }) {
  const location = useLocation()
  const workforceRoute = /^\/(?:(?:nurse|pathologist|hr|freelancer)\/login|(?:nurse|pathologist|hr|freelancer)-portal)(?:\/|$)/.test(location.pathname)
  const localAdminBypass = import.meta.env.DEV
    && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && window.location.port === '5174'
    && !workforceRoute
  const [session, setSession] = useState(() => readStaffSession())
  const sessionToken = session?.token || ''
  const [actor, setActor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setAccessTokenProvider(!localAdminBypass && sessionToken ? async () => sessionToken : null)
    return () => setAccessTokenProvider(null)
  }, [localAdminBypass, sessionToken])

  const refreshActor = useCallback(async () => {
    if (!localAdminBypass && !sessionToken) {
      setActor(null)
      setError('')
      setLoading(false)
      return null
    }

    setLoading(true)
    setError('')
    try {
      const current = await api.getCurrentActor(localAdminBypass ? undefined : sessionToken)
      setActor(current)
      return current
    } catch (loadError) {
      if (!localAdminBypass && loadError.status === 401) {
        clearStaffSession()
        setSession(null)
      }
      setActor(null)
      setError(loadError.message || 'Unable to verify your MediCare access.')
      return null
    } finally {
      setLoading(false)
    }
  }, [localAdminBypass, sessionToken])

  useEffect(() => {
    const timeout = window.setTimeout(refreshActor, 0)
    return () => window.clearTimeout(timeout)
  }, [refreshActor])

  const login = useCallback(async ({ email, password, role }) => {
    setLoading(true)
    setError('')
    try {
      const result = await api.staffLogin({ email, password, role })
      const nextSession = { token: result.token, staff: result.data }
      const nextActor = {
        id: result.data.id,
        authType: 'jwt',
        role: result.data.role,
        name: result.data.name,
        email: result.data.email,
        staffId: result.data.id,
        staff: result.data,
      }
      saveStaffSession(nextSession)
      setAccessTokenProvider(async () => result.token)
      setSession(nextSession)
      setActor(nextActor)
      return nextActor
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    if (localAdminBypass) {
      window.location.assign('/')
      return
    }
    clearStaffSession()
    setAccessTokenProvider(null)
    setSession(null)
    setActor(null)
    window.location.assign('/login')
  }, [localAdminBypass])

  const value = useMemo(() => ({
    actor,
    error,
    isLoaded: true,
    isSignedIn: localAdminBypass || Boolean(sessionToken),
    localAdminBypass,
    loading,
    login,
    refreshActor,
    logout,
  }), [actor, error, loading, localAdminBypass, login, refreshActor, logout, sessionToken])

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>
}
