import assert from 'node:assert/strict'
import test from 'node:test'
import { appointmentDateTime, cleanSchedule, formatCurrency, formatDate, isAvailable, normalizeWeeklySchedule, paymentCurrency } from './format.js'
import { patientDetailsError } from './validation.js'
import { confirmedPaymentState } from './payment.js'

test('booking dates exclude elapsed and reserved times while retaining future weekly slots', () => {
  const days = cleanSchedule({ mon: ['09:00 AM', '10:00 AM', '11:00 AM', '01:30 PM'] }, {
    now: new Date(2026, 10, 2, 10, 0),
    bookedSlots: { '2026-11-02': ['11:00 AM'] },
    horizonDays: 8,
  })
  assert.deepEqual(days[0], { date: '2026-11-02', slots: ['01:30 PM'] })
  assert.deepEqual(days[1], { date: '2026-11-09', slots: ['09:00 AM', '10:00 AM', '11:00 AM', '01:30 PM'] })
})

test('weekly schedules normalize names, reject malformed times, and sort noon correctly', () => {
  assert.deepEqual(normalizeWeeklySchedule({ Mon: ['12:00 PM', '9:00 AM', '13:00 PM'], monday: ['09:00 AM', '12:00 AM'] }), {
    monday: ['12:00 AM', '09:00 AM', '12:00 PM'],
  })
  assert.equal(isAvailable(null), false)
  assert.equal(isAvailable({ availability: ' Available ' }), true)
  assert.equal(formatDate('bad-date'), 'Date unavailable')
  assert.notEqual(formatDate('2026-11-02T10:00:00.000Z'), '2026-11-02T10:00:00.000Z')
})

test('appointment timestamps distinguish morning from afternoon and support legacy time fields', () => {
  const morning = appointmentDateTime({ date: '2026-11-02', time: '09:15 AM' })
  const afternoon = appointmentDateTime({ date: '2026-11-02', hour: 1, minute: 15, ampm: 'PM' })
  assert.equal(afternoon - morning, 4 * 60 * 60 * 1000)
  assert.equal(appointmentDateTime({ date: '2026-11-02', time: 'invalid' }), null)
})

test('patient booking validation rejects invalid contact details and ages, including fractional ages', () => {
  const valid = { patientName: 'Ayesha Khan', mobile: '+880 1712 345678', age: '0' }
  assert.equal(patientDetailsError(valid), '')
  for (const age of ['-1', '121', '3.5', 'abc']) assert.match(patientDetailsError({ ...valid, age }), /age/i)
  for (const mobile of ['abc1234567', '123', '++8801712345678']) assert.match(patientDetailsError({ ...valid, mobile }), /mobile/i)
  assert.equal(patientDetailsError({ ...valid, age: '' }), '')
})

test('payment confirmation retains terminal booking and refund states', () => {
  assert.equal(confirmedPaymentState({ status: 'Canceled', payment: { status: 'Paid' } }), 'booking-canceled')
  assert.equal(confirmedPaymentState({ status: 'Completed', payment: { status: 'Paid' } }), 'completed')
  assert.equal(confirmedPaymentState({ status: 'Rescheduled', payment: { status: 'Paid' } }), 'rescheduled')
  assert.equal(confirmedPaymentState({ status: 'Canceled', payment: { status: 'Refunded' } }), 'refunded')
  assert.equal(confirmedPaymentState({ status: 'Confirmed', payment: { status: 'Paid' } }), 'success')
})

test('currency formatting preserves decimal fees and the actual currency of historical payments', () => {
  const options = { style: 'currency', minimumFractionDigits: 0, maximumFractionDigits: 2 }
  assert.equal(formatCurrency(1250.5), new Intl.NumberFormat('en-BD', { ...options, currency: 'BDT' }).format(1250.5))
  assert.equal(formatCurrency(1250.5, 'inr'), new Intl.NumberFormat('en-BD', { ...options, currency: 'INR' }).format(1250.5))
  assert.equal(paymentCurrency({ payment: { method: 'Online' } }), 'INR')
  assert.equal(paymentCurrency({ payment: { method: 'Cash' } }), 'BDT')
  assert.equal(paymentCurrency({ payment: { method: 'Online', currency: 'bdt' } }), 'BDT')
})
