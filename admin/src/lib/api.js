const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
let accessTokenProvider = null

export function setAccessTokenProvider(provider) {
  accessTokenProvider = typeof provider === 'function' ? provider : null
}

async function request(path, options = {}) {
  const body = options.body
  const isFormData = body instanceof FormData
  const token = options.token || (accessTokenProvider ? await accessTokenProvider() : '')
  const headers = new Headers(options.headers || {})
  if (!isFormData && body !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: isFormData || body === undefined ? body : JSON.stringify(body),
    })

    if (response.status === 401 && accessTokenProvider) {
      const freshToken = await accessTokenProvider({ skipCache: true })
      if (freshToken && freshToken !== token) {
        headers.set('Authorization', `Bearer ${freshToken}`)
        response = await fetch(`${API_BASE}${path}`, {
          method: options.method || 'GET',
          headers,
          body: isFormData || body === undefined ? body : JSON.stringify(body),
        })
      }
    }
  } catch {
    throw new Error('Unable to reach MediCare. Check that the server is running and try again.')
  }

  const payload = await parseJson(response)
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || `Request failed with status ${response.status}`)
    error.status = response.status
    error.payload = payload
    throw error
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
  staffLogin: (body) => request('/api/staff/login', { method: 'POST', body }),
  getCurrentActor: (token) => request('/api/auth/me', { token }).then((data) => data.data),
  claimStaffAccount: (token) => request('/api/auth/claim-staff', { method: 'POST', body: {}, token }).then((data) => data.data),

  getDoctors: (params) => request(withQuery('/api/doctors/admin', params)).then((data) => data.data || data.doctors || []),
  getDoctorsPage: (params) => request(withQuery('/api/doctors/admin', params)),
  createDoctor: (formData) => request('/api/doctors', { method: 'POST', body: formData }),
  deleteDoctor: (id) => request(`/api/doctors/${id}`, { method: 'DELETE' }),

  getServices: () => request('/api/services').then((data) => data.data || []),
  createService: (formData) => request('/api/services', { method: 'POST', body: formData }),
  updateService: (id, formData) => request(`/api/services/${id}`, { method: 'PUT', body: formData }),
  deleteService: (id) => request(`/api/services/${id}`, { method: 'DELETE' }),

  getAppointments: (params) => request(withQuery('/api/appointments', params)).then((data) => data.appointment || data.appointments || []),
  getAppointmentsPage: (params) => request(withQuery('/api/appointments', params)),
  getAppointmentStats: () => request('/api/appointments/stats/summary'),
  updateAppointment: (id, body) => request(`/api/appointments/${id}`, { method: 'PUT', body }),
  cancelAppointment: (id) => request(`/api/appointments/${id}/cancel`, { method: 'POST', body: {} }),

  getServiceAppointments: (params) => request(withQuery('/api/service-appointments', params)).then((data) => data.appointment || data.data || []),
  getServiceAppointmentsPage: (params) => request(withQuery('/api/service-appointments', params)),
  getServiceAppointmentStats: () => request('/api/service-appointments/stats/summary'),
  updateServiceAppointment: (id, body) => request(`/api/service-appointments/${id}`, { method: 'PUT', body }),
  cancelServiceAppointment: (id) => request(`/api/service-appointments/${id}/cancel`, { method: 'POST', body: {} }),

  getStaff: (params) => request(withQuery('/api/staff', params)),
  getStaffMember: (id) => request(`/api/staff/${id}`).then((data) => data.data),
  getStaffStats: () => request('/api/staff/stats').then((data) => data.data),
  createStaff: (body) => request('/api/staff', { method: 'POST', body }).then((data) => data),
  updateStaff: (id, body) => request(`/api/staff/${id}`, { method: 'PUT', body }).then((data) => data),
  updateStaffStatus: (id, status) => request(`/api/staff/${id}/status`, { method: 'PATCH', body: { status } }).then((data) => data),
  deactivateStaff: (id) => request(`/api/staff/${id}`, { method: 'DELETE' }).then((data) => data),

  getDashboard: () => request('/api/dashboard').then((data) => data.data),
  getMyProfile: () => request('/api/staff/me').then((data) => data.data),
  updateMyProfile: (body) => request('/api/staff/me', { method: 'PATCH', body }),

  getShifts: (params) => request(withQuery('/api/shifts', params)),
  getMyShifts: (params) => request(withQuery('/api/shifts/my', params)).then((data) => data.data || []),
  createShift: (body) => request('/api/shifts', { method: 'POST', body }),
  updateShift: (id, body) => request(`/api/shifts/${id}`, { method: 'PUT', body }),
  cancelShift: (id) => request(`/api/shifts/${id}`, { method: 'DELETE' }),

  getLabTests: (params) => request(withQuery('/api/lab-tests', params)),
  createLabTest: (body) => request('/api/lab-tests', { method: 'POST', body }),
  assignLabTest: (id, pathologistId) => request(`/api/lab-tests/${id}/assign`, { method: 'PATCH', body: { pathologistId } }),
  updateLabStatus: (id, status) => request(`/api/lab-tests/${id}/status`, { method: 'PATCH', body: { status } }),
  submitLabResult: (id, body) => request(`/api/lab-tests/${id}/result`, { method: 'PUT', body }),

  getManagedJobs: (params) => request(withQuery('/api/jobs/manage', params)).then((data) => data.data || []),
  createJob: (body) => request('/api/jobs', { method: 'POST', body }),
  updateJob: (id, body) => request(`/api/jobs/${id}`, { method: 'PUT', body }),
  updateJobStatus: (id, status) => request(`/api/jobs/${id}/status`, { method: 'PATCH', body: { status } }),
  getApplicants: (params) => request(withQuery('/api/applicants', params)),
  updateApplicantStatus: (id, status) => request(`/api/applicants/${id}/status`, { method: 'PATCH', body: { status } }),

  getAnnouncements: () => request('/api/announcements').then((data) => data.data || []),
  getMyAnnouncements: () => request('/api/announcements/my').then((data) => data.data || []),
  createAnnouncement: (body) => request('/api/announcements', { method: 'POST', body }),
  updateAnnouncement: (id, body) => request(`/api/announcements/${id}`, { method: 'PUT', body }),
  deleteAnnouncement: (id) => request(`/api/announcements/${id}`, { method: 'DELETE' }),
  markAnnouncementRead: (id) => request(`/api/announcements/${id}/read`, { method: 'PATCH', body: {} }),

  getAssignments: (params) => request(withQuery('/api/freelancer-assignments', params)),
  getMyAssignments: (params) => request(withQuery('/api/freelancer-assignments/my', params)).then((data) => data.data || []),
  createAssignment: (body) => request('/api/freelancer-assignments', { method: 'POST', body }),
  updateAssignment: (id, body) => request(`/api/freelancer-assignments/${id}`, { method: 'PUT', body }),
  updateAssignmentStatus: (id, status) => request(`/api/freelancer-assignments/${id}/status`, { method: 'PATCH', body: { status } }),
}

export function appendFormFields(formData, values) {
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value)
    }
  })
}
