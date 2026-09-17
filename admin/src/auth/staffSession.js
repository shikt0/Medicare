const STAFF_SESSION_KEY = 'medicare_staff_session'

export function readStaffSession() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STAFF_SESSION_KEY) || 'null')
    return value?.token && value?.staff ? value : null
  } catch {
    return null
  }
}

export function saveStaffSession(session) {
  window.sessionStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session))
}

export function clearStaffSession() {
  window.sessionStorage.removeItem(STAFF_SESSION_KEY)
}
