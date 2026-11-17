const STAFF_SESSION_KEY = 'medicare_staff_session'

export function readStaffSession() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STAFF_SESSION_KEY) || 'null')
    return typeof value?.token === 'string' && value.token && value?.staff?.role ? value : null
  } catch {
    return null
  }
}

export function saveStaffSession(session) {
  try {
    window.sessionStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session))
  } catch {
    throw new Error('Your browser could not save this session. Allow site storage and try again.')
  }
}

export function clearStaffSession() {
  try {
    window.sessionStorage.removeItem(STAFF_SESSION_KEY)
  } catch {
    // The in-memory session is still cleared when storage is unavailable.
  }
}
