import { API_BASE } from './api'

async function assistantRequest(path, { token, body, signal } = {}) {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, body ? 120000 : 12000)
  try {
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    const response = await fetch(`${API_BASE}/api/assistant/${path}`, {
      method: body ? 'POST' : 'GET', headers, signal: controller.signal,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload.success === false) {
      const fallback = response.status === 429
        ? 'The assistant is helping another person. Please try again in a moment.'
        : response.status === 503
          ? 'The local assistant is offline. You can still book an appointment using the booking tab.'
          : 'The assistant could not complete this request. Please try again.'
      const error = new Error(payload.message || fallback)
      error.status = response.status
      throw error
    }
    return payload.data || payload
  } catch (error) {
    if (timedOut) throw new Error('The local model is taking longer than expected. Try a shorter question or retry.')
    if (error.name === 'AbortError' || error.status) throw error
    throw new Error(error.message === 'Failed to fetch'
      ? 'Unable to reach the assistant. Check that the MediCare server is running.'
      : error.message)
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

export const assistantApi = {
  status: (signal) => assistantRequest('status', { signal }),
  chat: (body, token, signal) => assistantRequest('chat', { body, token, signal }),
}
