import assert from 'node:assert/strict'
import test from 'node:test'
import { patientApi } from './api.js'

test('clinical appointment loading includes subsequent pages and authenticates each request', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: new URL(url), options })
    return Response.json({ success: true, appointments: [{ _id: `appointment-${calls.length}` }], meta: { total: 2 } })
  })
  const result = await patientApi.getDoctorPortalAppointments('doctor-token')
  assert.equal(result.appointments.length, 2)
  assert.deepEqual(calls.map(({ url }) => url.searchParams.get('page')), ['1', '2'])
  assert.ok(calls.every(({ options }) => options.headers.get('Authorization') === 'Bearer doctor-token'))
})

test('both payment confirmation endpoints pass the patient token and session safely', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url: new URL(url), options })
    return Response.json({ success: true })
  })
  await patientApi.confirmAppointmentPayment('cs_test&value', 'patient-token')
  await patientApi.confirmServicePayment('cs_service', 'patient-token')
  assert.equal(calls[0].url.searchParams.get('session_id'), 'cs_test&value')
  assert.ok(calls.every(({ options }) => options.headers.get('Authorization') === 'Bearer patient-token'))
})

test('HTML server failures produce readable errors with the original response status', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Internal server stack</html>', { status: 502 }))
  await assert.rejects(patientApi.getServices(), (error) => error.status === 502 && /unexpected response/.test(error.message) && !error.message.includes('<html>'))
})
