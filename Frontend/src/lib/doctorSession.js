const DOCTOR_SESSION_KEY = 'medicare_doctor_session'

export function readDoctorSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(DOCTOR_SESSION_KEY) || 'null')
    return value?.token && value?.doctor ? value : null
  } catch {
    return null
  }
}

export function saveDoctorSession(session) {
  sessionStorage.setItem(DOCTOR_SESSION_KEY, JSON.stringify(session))
}

export function clearDoctorSession() {
  sessionStorage.removeItem(DOCTOR_SESSION_KEY)
}

