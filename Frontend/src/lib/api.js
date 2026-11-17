const API_BASE = (import.meta.env?.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 30000)
  let response
  let payload
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      signal: controller.signal,
      body: options.body instanceof FormData || options.body === undefined
        ? options.body
        : JSON.stringify(options.body),
    })
    payload = await parsePayload(response)
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The request took too long. Please try again.')
    throw new Error('Unable to reach MediCare. Check that the server is running and try again.')
  } finally {
    globalThis.clearTimeout(timeout)
  }

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
    return { success: false, message: 'The server returned an unexpected response. Please try again.' }
  }
}

// The directory and clinical overview use local filtering, so load every page.
async function allPages(path, params, key, token) {
  let page = 1
  let first
  const items = []
  while (true) {
    const payload = await request(withQuery(path, { ...params, page }), { token })
    first ||= payload
    const batch = Array.isArray(payload[key]) ? payload[key] : []
    items.push(...batch)
    if (!batch.length || !payload.meta?.total || items.length >= payload.meta.total) break
    page += 1
  }
  return { ...first, [key]: items }
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
  getAllDoctors: () => allPages('/api/doctors', { limit: 500 }, 'data').then((payload) => payload.data),
  getDoctor: (id) => request(`/api/doctors/${id}`).then((payload) => payload.data),
  getServices: () => request('/api/services').then((payload) => payload.data || []),
  getService: (id) => request(`/api/services/${id}`).then((payload) => payload.data),

  createAppointment: (body, token) => request('/api/appointments', { method: 'POST', body, token }),
  createServiceAppointment: (body, token) => request('/api/service-appointments', { method: 'POST', body, token }),
  getMyAppointments: (token) => request('/api/appointments/me', { token }).then((payload) => payload.appointments || []),
  getMyServiceAppointments: (token) => request('/api/service-appointments/me', { token }).then((payload) => payload.data || []),
  cancelAppointment: (id, token) => request(`/api/appointments/${id}/cancel`, { method: 'POST', body: {}, token }),
  cancelServiceAppointment: (id, token) => request(`/api/service-appointments/${id}/cancel`, { method: 'POST', body: {}, token }),
  confirmAppointmentPayment: (sessionId, token) => request(withQuery('/api/appointments/confirm', { session_id: sessionId }), { token }),
  confirmServicePayment: (sessionId, token) => request(withQuery('/api/service-appointments/confirm', { session_id: sessionId }), { token }),
  sendContactMessage: (body, token) => request('/api/contact', { method: 'POST', body, token }),
  doctorLogin: (body) => request('/api/doctors/login', { method: 'POST', body }),
  getDoctorPortalMe: (token) => request('/api/doctor-portal/me', { token }).then((payload) => payload.data),
  getDoctorPortalAppointments: (token, params = {}) => allPages('/api/doctor-portal/appointments', { limit: 200, ...params }, 'appointments', token),
  updateDoctorPortalAppointment: (id, body, token) => request(`/api/doctor-portal/appointments/${id}`, { method: 'PATCH', body, token }).then((payload) => payload.appointment),
  updateDoctorProfile: (id, body, token) => request(`/api/doctors/${id}`, { method: 'PUT', body, token }).then((payload) => payload.data),
  toggleDoctorAvailability: (id, token) => request(`/api/doctors/${id}/toggle-availability`, { method: 'POST', body: {}, token }).then((payload) => payload.data),
  getMyLabResults: (token) => allPages('/api/lab-tests', { limit: 200 }, 'data', token).then((payload) => payload.data),
  getDoctorLabTests: (token, params = {}) => allPages('/api/lab-tests', { limit: 200, ...params }, 'data', token).then((payload) => payload.data),
  createLabTest: (body, token) => request('/api/lab-tests', { method: 'POST', body, token }).then((payload) => payload.data),
}

export { API_BASE }
