import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, setAccessTokenProvider } from '../lib/api'
import { StaffAuthContext } from './staffAuth'
import { clearStaffSession, readStaffSession, saveStaffSession } from './staffSession'

const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

export function StaffAuthProvider({ children }) {
  return clerkConfigured
    ? <ClerkSessionProvider>{children}</ClerkSessionProvider>
    : <SessionProvider>{children}</SessionProvider>
}

function ClerkSessionProvider({ children }) {
  const clerk = useAuth()
  return <SessionProvider clerk={clerk}>{children}</SessionProvider>
}

function SessionProvider({ children, clerk }) {
  const location = useLocation()
  const navigate = useNavigate()
  const workforceRoute = /^\/(?:(?:nurse|pathologist|hr|freelancer)\/login|(?:nurse|pathologist|hr|freelancer)-portal)(?:\/|$)/.test(location.pathname)
  const [session, setSession] = useState(() => readStaffSession())
  const sessionToken = session?.token || ''
  const localAdminBypass = import.meta.env.DEV
    && import.meta.env.VITE_ENABLE_LOCAL_ADMIN === 'true'
    && ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && window.location.port === '5174'
    && !workforceRoute
    && !sessionToken
    && !['/login', '/unauthorized'].includes(location.pathname)
    && !location.pathname.startsWith('/admin/login')
  const clerkSignedIn = Boolean(!sessionToken && !workforceRoute && clerk?.isSignedIn)
  const clerkLoading = Boolean(!sessionToken && !workforceRoute && clerk && !clerk.isLoaded)
  const getClerkToken = clerk?.getToken
  const clerkSignOut = clerk?.signOut
  const authKey = localAdminBypass ? 'local-admin' : sessionToken || (clerkSignedIn ? clerk.sessionId : 'signed-out')
  const [verifiedKey, setVerifiedKey] = useState(null)
  const [actor, setActor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)

  const getAccessToken = useCallback(async (options) => {
    if (localAdminBypass) return ''
    if (sessionToken) return sessionToken
    return clerkSignedIn ? (await getClerkToken(options)) || '' : ''
  }, [getClerkToken, localAdminBypass, sessionToken, clerkSignedIn])

  useEffect(() => {
    setAccessTokenProvider(getAccessToken)
    return () => setAccessTokenProvider(null)
  }, [getAccessToken])

  const refreshActor = useCallback(async () => {
    const requestId = ++requestSequence.current
    if (clerkLoading) return null
    if (!localAdminBypass && !sessionToken && !clerkSignedIn) {
      setActor(null)
      setError('')
      setVerifiedKey(authKey)
      setLoading(false)
      return null
    }

    setLoading(true)
    setError('')
    try {
      const token = await getAccessToken()
      const current = await api.getCurrentActor(token)
      if (requestId !== requestSequence.current) return null
      setActor(current)
      return current
    } catch (loadError) {
      if (requestId !== requestSequence.current) return null
      if (sessionToken && loadError.status === 401) {
        clearStaffSession()
        setSession(null)
      }
      setActor(null)
      setError(loadError.message || 'Unable to verify your MediCare access.')
      return null
    } finally {
      if (requestId === requestSequence.current) {
        setVerifiedKey(authKey)
        setLoading(false)
      }
    }
  }, [authKey, clerkLoading, clerkSignedIn, getAccessToken, localAdminBypass, sessionToken])

  useEffect(() => {
    const timeout = window.setTimeout(refreshActor, 0)
    return () => {
      window.clearTimeout(timeout)
      requestSequence.current += 1
    }
  }, [refreshActor])

  const login = useCallback(async ({ email, password, role }) => {
    requestSequence.current += 1
    setLoading(true)
    setError('')
    try {
      const result = await api.staffLogin({ email, password, role })
      if (!result.token || !result.data || result.data.role !== role) {
        throw new Error('Unable to verify the staff account. Please try again.')
      }
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
      setVerifiedKey(result.token)
      return nextActor
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    requestSequence.current += 1
    clearStaffSession()
    setAccessTokenProvider(null)
    setSession(null)
    setActor(null)
    setError('')
    if (clerkSignedIn && clerkSignOut) {
      try {
        await clerkSignOut({ redirectUrl: '/login' })
      } catch {
        setError('Unable to sign out. Please try again.')
      }
    } else {
      navigate('/login', { replace: true })
    }
  }, [clerkSignOut, clerkSignedIn, navigate])

  const busy = loading || clerkLoading || verifiedKey !== authKey
  const value = useMemo(() => ({
    actor,
    error,
    isLoaded: !clerkLoading,
    isSignedIn: localAdminBypass || Boolean(sessionToken) || clerkSignedIn,
    localAdminBypass,
    loading: busy,
    login,
    refreshActor,
    logout,
  }), [actor, error, busy, clerkLoading, clerkSignedIn, localAdminBypass, login, refreshActor, logout, sessionToken])

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>
}
