const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')

async function request(path, options = {}) {
  const body = options.body
  const isFormData = body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData || body === undefined ? body : JSON.stringify(body),
  })

  const payload = await parseJson(response)
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`)
  }

  return payload
}

async function parseJson(response) {
  const text = await response.text()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { success: false, message: text }
  }
}

function withQuery(path, params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value)
    }
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export const api = {
  getDoctors: (params) => request(withQuery('/api/doctors', params)).then((data) => data.data || data.doctors || []),
  createDoctor: (formData) => request('/api/doctors', { method: 'POST', body: formData }),
  deleteDoctor: (id) => request(`/api/doctors/${id}`, { method: 'DELETE' }),

  getServices: () => request('/api/services').then((data) => data.data || []),
  createService: (formData) => request('/api/services', { method: 'POST', body: formData }),
  updateService: (id, formData) => request(`/api/services/${id}`, { method: 'PUT', body: formData }),
  deleteService: (id) => request(`/api/services/${id}`, { method: 'DELETE' }),

  getAppointments: (params) => request(withQuery('/api/appointments', params)).then((data) => data.appointment || data.appointments || []),
  updateAppointment: (id, body) => request(`/api/appointments/${id}`, { method: 'PUT', body }),
  cancelAppointment: (id) => request(`/api/appointments/${id}/cancel`, { method: 'POST', body: {} }),

  getServiceAppointments: (params) => request(withQuery('/api/service-appointments', params)).then((data) => data.appointment || data.data || []),
  updateServiceAppointment: (id, body) => request(`/api/service-appointments/${id}`, { method: 'PUT', body }),
  cancelServiceAppointment: (id) => request(`/api/service-appointments/${id}/cancel`, { method: 'POST', body: {} }),
}

export function appendFormFields(formData, values) {
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value)
    }
  })
}
