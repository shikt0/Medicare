const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body instanceof FormData || options.body === undefined
        ? options.body
        : JSON.stringify(options.body),
    })
  } catch {
    throw new Error('Unable to reach MediCare. Check that the server is running and try again.')
  }

  const payload = await parsePayload(response)
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || `Request failed with status ${response.status}`)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

async function parsePayload(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { success: false, message: text }
  }
}

function withQuery(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const value = query.toString()
  return value ? `${path}?${value}` : path
}

export const patientApi = {
  getDoctors: (params = {}) => request(withQuery('/api/doctors', params)),
  getDoctor: (id) => request(`/api/doctors/${id}`).then((payload) => payload.data),
  getServices: () => request('/api/services').then((payload) => payload.data || []),
  getService: (id) => request(`/api/services/${id}`).then((payload) => payload.data),

  createAppointment: (body, token) => request('/api/appointments', { method: 'POST', body, token }),
  createServiceAppointment: (body, token) => request('/api/service-appointments', { method: 'POST', body, token }),
  getMyAppointments: (token) => request('/api/appointments/me', { token }).then((payload) => payload.appointments || []),
  getMyServiceAppointments: (token) => request('/api/service-appointments/me', { token }).then((payload) => payload.data || []),
  cancelAppointment: (id, token) => request(`/api/appointments/${id}/cancel`, { method: 'POST', body: {}, token }),
  cancelServiceAppointment: (id, token) => request(`/api/service-appointments/${id}/cancel`, { method: 'POST', body: {}, token }),
  confirmAppointmentPayment: (sessionId) => request(withQuery('/api/appointments/confirm', { session_id: sessionId })),
  confirmServicePayment: (sessionId) => request(withQuery('/api/service-appointments/confirm', { session_id: sessionId })),
  sendContactMessage: (body, token) => request('/api/contact', { method: 'POST', body, token }),
  doctorLogin: (body) => request('/api/doctors/login', { method: 'POST', body }),
  getDoctorPortalMe: (token) => request('/api/doctor-portal/me', { token }).then((payload) => payload.data),
  getDoctorPortalAppointments: (token, params = {}) => request(withQuery('/api/doctor-portal/appointments', params), { token }),
  updateDoctorPortalAppointment: (id, body, token) => request(`/api/doctor-portal/appointments/${id}`, { method: 'PATCH', body, token }).then((payload) => payload.appointment),
  updateDoctorProfile: (id, body, token) => request(`/api/doctors/${id}`, { method: 'PUT', body, token }).then((payload) => payload.data),
  toggleDoctorAvailability: (id, token) => request(`/api/doctors/${id}/toggle-availability`, { method: 'POST', body: {}, token }).then((payload) => payload.data),
  getMyLabResults: (token) => request('/api/lab-tests', { token }).then((payload) => payload.data || []),
  getDoctorLabTests: (token, params = {}) => request(withQuery('/api/lab-tests', params), { token }).then((payload) => payload.data || []),
  createLabTest: (body, token) => request('/api/lab-tests', { method: 'POST', body, token }).then((payload) => payload.data),
}

export { API_BASE }
