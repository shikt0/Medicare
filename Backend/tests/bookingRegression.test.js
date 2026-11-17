import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import Appointment from '../models/Appointment.js'
import Doctor from '../models/Doctor.js'
import ServiceAppointment from '../models/serviceAppointment.js'
import { createAppointment, updateAppointment, getAppointment, getStats } from '../controllers/appointmentController.js'
import { cancelServiceAppointment, updateServiceAppointment, CreateServiceAppointment } from '../controllers/serviceAppointmentController.js'
import { weekdayKeyForDate } from '../utils/weeklySchedule.js'
import { createDoctor, getDoctors } from '../controllers/doctorController.js'
import { createService } from '../controllers/serviceController.js'
import { updateDoctorPortalAppointment } from '../controllers/doctorPortalController.js'
import { APPOINTMENT_SLOT_INDEX_KEYS, APPOINTMENT_SLOT_INDEX_OPTIONS } from '../utils/appointmentSlots.js'

const id = '507f1f77bcf86cd799439011'
const doctorId = '507f191e810c19729de860ea'
const date = '2099-01-05'
const time = '09:30 AM'
const actor = { id: 'patient-1', authType: 'clerk', role: 'patient' }
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(payload) { this.payload = payload; return this } })

beforeEach((t) => {
  t.mock.method(Appointment.collection, 'listIndexes', () => ({ toArray: async () => [{ key: APPOINTMENT_SLOT_INDEX_KEYS, ...APPOINTMENT_SLOT_INDEX_OPTIONS }] }))
})

test('rescheduling rejects impossible dates before looking up a doctor', async (t) => {
  t.mock.method(Appointment, 'findById', async () => ({ status: 'Pending', doctorId }))
  const doctorLookup = t.mock.method(Doctor, 'findById', () => { throw new Error('Unexpected doctor query') })
  const res = response()
  await updateAppointment({ params: { id }, body: { date: '2099-02-30', time } }, res)
  assert.equal(res.statusCode, 400)
  assert.equal(doctorLookup.mock.callCount(), 0)
})

test('rescheduling rejects booked slots and excludes the current appointment from conflicts', async (t) => {
  t.mock.method(Appointment, 'findById', async () => ({ status: 'Pending', doctorId }))
  t.mock.method(Doctor, 'findById', () => ({ lean: async () => ({ availability: 'Available', schedule: { [weekdayKeyForDate(date)]: [time] } }) }))
  const conflict = t.mock.method(Appointment, 'findOne', () => ({ lean: async () => ({ _id: 'other-appointment' }) }))
  const res = response()
  await updateAppointment({ params: { id }, body: { date, time: '9:30 am' } }, res)
  assert.equal(res.statusCode, 409)
  assert.deepEqual(conflict.mock.calls[0].arguments[0], { _id: { $ne: id }, doctorId, date, time, status: { $ne: 'Canceled' } })
})

test('rescheduling cannot use a time outside the doctor weekly schedule', async (t) => {
  t.mock.method(Appointment, 'findById', async () => ({ status: 'Pending', doctorId }))
  t.mock.method(Doctor, 'findById', () => ({ lean: async () => ({ availability: 'Available', schedule: {} }) }))
  const res = response()
  await updateAppointment({ params: { id }, body: { date, time } }, res)
  assert.equal(res.statusCode, 409)
})

test('invalid booking IDs and ages return validation errors rather than database errors', async () => {
  for (const [handler, body] of [
    [createAppointment, { doctorId: 'invalid', patientName: 'Patient', mobile: '123', date, time }],
    [createAppointment, { doctorId, patientName: 'Patient', mobile: '123', date, time, age: 'invalid' }],
    [CreateServiceAppointment, { serviceId: 'invalid', patientName: 'Patient', mobile: '123' }],
    [CreateServiceAppointment, { serviceId: id, patientName: 'Patient', mobile: '123', age: -1 }],
  ]) {
    const res = response()
    await handler({ actor, body }, res)
    assert.equal(res.statusCode, 400)
  }
})

test('appointment search treats regex punctuation as literal text', async (t) => {
  let filter
  const query = { sort() { return this }, skip() { return this }, limit() { return this }, populate() { return this }, lean: async () => [] }
  t.mock.method(Appointment, 'find', (value) => { filter = value; return query })
  t.mock.method(Appointment, 'countDocuments', async () => 0)
  const res = response()
  await getAppointment({ query: { search: '[' } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(filter.$or[0].patientName.test('Patient [one]'), true)
  assert.equal(filter.$or[0].patientName.test('Patient one'), false)
})

test('canceling a paid service does not falsely record a refund', async (t) => {
  const booking = { createdBy: actor.id, status: 'Confirmed', payment: { status: 'Paid', providerId: 'pi_1' }, async save() {} }
  t.mock.method(ServiceAppointment, 'findById', async () => booking)
  const res = response()
  await cancelServiceAppointment({ params: { id }, actor }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(booking.status, 'Canceled')
  assert.equal(booking.payment.status, 'Paid')
})

test('completed and canceled service requests cannot be reopened', async (t) => {
  let booking
  t.mock.method(ServiceAppointment, 'findById', () => ({ select() { return this }, lean: async () => booking }))
  for (const status of ['Completed', 'Canceled']) {
    booking = { status, payment: { status: 'Paid' } }
    const res = response()
    await updateServiceAppointment({ params: { id }, actor: { role: 'admin' }, body: { status: 'Confirmed' } }, res)
    assert.equal(res.statusCode, 400)
  }
})

test('service payment corrections preserve checkout fields and completed status', async (t) => {
  const booking = { status: 'Completed', fees: 100, payment: { method: 'Cash', status: 'Pending', sessionId: 'cs_original' } }
  t.mock.method(ServiceAppointment, 'findById', () => ({ select() { return this }, lean: async () => booking }))
  const save = t.mock.method(ServiceAppointment, 'findByIdAndUpdate', async () => booking)
  const res = response()
  await updateServiceAppointment({ params: { id }, actor: { role: 'admin' }, body: { payment: { status: 'Paid' } } }, res)
  assert.equal(res.statusCode, 200)
  const update = save.mock.calls[0].arguments[1].$set
  assert.equal(update['payment.status'], 'Paid')
  assert.equal(Object.hasOwn(update, 'payment'), false)
  assert.equal(Object.hasOwn(update, 'status'), false)
})

test('invalid service prices cannot silently become free services', async () => {
  for (const price of ['not-a-price', '12.5.2', -1, Number.POSITIVE_INFINITY, {}]) {
    const res = response()
    await createService({ body: { name: 'Blood test', price } }, res)
    assert.equal(res.statusCode, 400)
  }
})

test('missing token configuration is rejected before persisting a doctor account', async (t) => {
  const previous = process.env.JWT_SECRET
  delete process.env.JWT_SECRET
  const lookup = t.mock.method(Doctor, 'findOne', () => { throw new Error('Unexpected database call') })
  try {
    const res = response()
    await createDoctor({ body: { name: 'Doctor', email: 'doctor@example.com', password: 'test-password' } }, res)
    assert.equal(res.statusCode, 503)
    assert.equal(lookup.mock.callCount(), 0)
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = previous
  }
})

test('doctor search accepts literal punctuation', async (t) => {
  const aggregate = t.mock.method(Doctor, 'aggregate', async () => [])
  t.mock.method(Doctor, 'countDocuments', async () => 0)
  const res = response()
  await getDoctors({ query: { q: '[' } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(aggregate.mock.calls[0].arguments[0][0].$match.$or[0].name.test('Dr [One]'), true)
})

test('doctor portal reschedules reject calendar overflow and occupied slots', async (t) => {
  const appointment = { _id: id, status: 'Confirmed', doctorId }
  let queryCount = 0
  t.mock.method(Appointment, 'findOne', () => {
    queryCount += 1
    return queryCount === 1 ? appointment : { lean: async () => ({ _id: 'conflict' }) }
  })
  const doctor = { _id: doctorId, availability: 'Available', schedule: { [weekdayKeyForDate(date)]: [time] } }
  for (const [requestedDate, code] of [['2099-02-30', 400], [date, 409]]) {
    queryCount = 0
    const res = response()
    await updateDoctorPortalAppointment({ params: { id }, doctor, body: { date: requestedDate, time } }, res)
    assert.equal(res.statusCode, code)
  }
})

test('new cash bookings persist the configured currency without converting the fee', async (t) => {
  const previous = process.env.PAYMENT_CURRENCY
  process.env.PAYMENT_CURRENCY = 'BDT'
  t.mock.method(Doctor, 'findById', () => ({ lean: async () => ({ _id: doctorId, name: 'Doctor', fee: 650, availability: 'Available', schedule: { [weekdayKeyForDate(date)]: [time] } }) }))
  t.mock.method(Appointment, 'findOne', () => ({ lean: async () => null }))
  const create = t.mock.method(Appointment, 'create', async (booking) => booking)
  try {
    const res = response()
    await createAppointment({ actor, body: { doctorId, patientName: 'Patient', mobile: '123', date, time, paymentMethod: 'Cash' } }, res)
    assert.equal(res.statusCode, 201)
    assert.equal(create.mock.calls[0].arguments[0].payment.currency, 'bdt')
    assert.equal(res.payload.appointment.payment.amount, 650)
    assert.equal(res.payload.appointment.fees, 650)
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_CURRENCY
    else process.env.PAYMENT_CURRENCY = previous
  }
})

test('appointment statistics return currency-specific revenue totals', async (t) => {
  t.mock.method(Appointment, 'countDocuments', async () => 3)
  let aggregateCall = 0
  t.mock.method(Appointment, 'aggregate', async () => {
    aggregateCall += 1
    return aggregateCall === 1 ? [{ _id: 'bdt', total: 300 }, { _id: 'inr', total: 125 }] : [{ _id: 'Completed', count: 3 }]
  })
  const res = response()
  await getStats({}, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.payload.stats.revenueByCurrency, { bdt: 300, inr: 125 })
  assert.equal(res.payload.stats.statusCounts.Completed, 3)
})

test('new bookings fail with 503 before persistence when the slot index is missing', async (t) => {
  t.mock.method(Appointment.collection, 'listIndexes', () => ({ toArray: async () => [] }))
  t.mock.method(Doctor, 'findById', () => ({ lean: async () => ({ _id: doctorId, fee: 650, availability: 'Available', schedule: { [weekdayKeyForDate(date)]: [time] } }) }))
  const create = t.mock.method(Appointment, 'create', async () => { throw new Error('Unexpected booking write') })
  const res = response()
  await createAppointment({ actor, body: { doctorId, patientName: 'Patient', mobile: '123', date, time, paymentMethod: 'Cash' } }, res)
  assert.equal(res.statusCode, 503)
  assert.equal(res.payload.code, 'BOOKING_INDEX_REQUIRED')
  assert.equal(create.mock.callCount(), 0)
})

test('a concurrent booking caught by the unique index returns 409', async (t) => {
  t.mock.method(Doctor, 'findById', () => ({ lean: async () => ({ _id: doctorId, fee: 650, availability: 'Available', schedule: { [weekdayKeyForDate(date)]: [time] } }) }))
  t.mock.method(Appointment, 'findOne', () => ({ lean: async () => null }))
  t.mock.method(Appointment, 'create', async () => { throw Object.assign(new Error('Duplicate key'), { code: 11000 }) })
  const res = response()
  await createAppointment({ actor, body: { doctorId, patientName: 'Patient', mobile: '123', date, time, paymentMethod: 'Cash' } }, res)
  assert.equal(res.statusCode, 409)
  assert.equal(res.payload.code, 'APPOINTMENT_SLOT_TAKEN')
})

test('a concurrent admin reschedule caught by the unique index returns 409', async (t) => {
  t.mock.method(Appointment, 'findById', async () => ({ status: 'Confirmed', doctorId }))
  t.mock.method(Doctor, 'findById', () => ({ lean: async () => ({ availability: 'Available', schedule: { [weekdayKeyForDate(date)]: [time] } }) }))
  t.mock.method(Appointment, 'findOne', () => ({ lean: async () => null }))
  t.mock.method(Appointment, 'findByIdAndUpdate', () => ({ populate() { return this }, lean: async () => { throw Object.assign(new Error('Duplicate key'), { code: 11000 }) } }))
  const res = response()
  await updateAppointment({ params: { id }, body: { date, time } }, res)
  assert.equal(res.statusCode, 409)
  assert.equal(res.payload.code, 'APPOINTMENT_SLOT_TAKEN')
})

test('a concurrent doctor reschedule caught by the unique index returns 409', async (t) => {
  const appointment = { _id: id, status: 'Confirmed', doctorId, async save() { throw Object.assign(new Error('Duplicate key'), { code: 11000 }) } }
  let queryCount = 0
  t.mock.method(Appointment, 'findOne', () => {
    queryCount += 1
    return queryCount === 1 ? appointment : { lean: async () => null }
  })
  const doctor = { _id: doctorId, availability: 'Available', schedule: { [weekdayKeyForDate(date)]: [time] } }
  const res = response()
  await updateDoctorPortalAppointment({ params: { id }, doctor, body: { date, time } }, res)
  assert.equal(res.statusCode, 409)
  assert.equal(res.payload.code, 'APPOINTMENT_SLOT_TAKEN')
})
