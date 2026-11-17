const DOCTOR_SESSION_KEY = 'medicare_doctor_session'
export const DOCTOR_SESSION_EVENT = 'medicare:doctor-session'

export function readDoctorSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(DOCTOR_SESSION_KEY) || 'null')
    if (typeof value?.token !== 'string' || !value?.doctor) return null
    const payload = value.token.split('.')[1]
    if (!payload) return null
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.exp && Number(claims.exp) * 1000 <= Date.now()) {
      clearDoctorSession()
      return null
    }
    return value
  } catch {
    return null
  }
}

export function saveDoctorSession(session) {
  sessionStorage.setItem(DOCTOR_SESSION_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event(DOCTOR_SESSION_EVENT))
}

export function clearDoctorSession() {
  try { sessionStorage.removeItem(DOCTOR_SESSION_KEY) } catch { /* Sign out still clears in-memory state when storage is unavailable. */ }
  window.dispatchEvent(new Event(DOCTOR_SESSION_EVENT))
}

