import test from 'node:test'
import assert from 'node:assert/strict'
import Appointment from '../models/Appointment.js'
import { APPOINTMENT_SLOT_INDEX_KEYS, APPOINTMENT_SLOT_INDEX_OPTIONS, auditAppointmentSlotIndex, inspectAppointmentSlots, isAppointmentSlotIndex, migrateAppointmentSlotIndex, requireAppointmentSlotIndex } from '../utils/appointmentSlots.js'

const requiredIndex = { key: APPOINTMENT_SLOT_INDEX_KEYS, ...APPOINTMENT_SLOT_INDEX_OPTIONS }
const record = (id, time = '09:30 AM') => ({ _id: id, doctorId: 'doctor-1', date: '2099-01-05', time })

function collectionStub(records, existingIndexes = []) {
  let indexes = existingIndexes
  const writes = []
  return {
    writes,
    find: () => records,
    listIndexes: () => ({ toArray: async () => indexes }),
    async createIndex(keys, options) {
      writes.push({ keys, options })
      indexes = [{ key: keys, ...options }]
    },
  }
}

test('slot protection requires a unique compound index covering every active status', () => {
  assert.equal(isAppointmentSlotIndex(requiredIndex), true)
  assert.equal(isAppointmentSlotIndex({ ...requiredIndex, unique: false }), false)
  assert.equal(isAppointmentSlotIndex({ ...requiredIndex, key: { doctorId: 1, date: 1 } }), false)
  assert.equal(isAppointmentSlotIndex({ ...requiredIndex, partialFilterExpression: { status: { $in: ['Pending'] } } }), false)
  assert.equal(Appointment.schema.options.autoIndex, false)
  assert.equal(Appointment.schema.indexes().some(([key, options]) => isAppointmentSlotIndex({ key, ...options })), true)
})

test('booking fails closed when the required database index is absent or unreadable', async () => {
  await assert.rejects(requireAppointmentSlotIndex(collectionStub([])), { code: 'BOOKING_INDEX_REQUIRED' })
  await assert.rejects(requireAppointmentSlotIndex({ listIndexes() { throw new Error('DB unavailable') } }), { code: 'BOOKING_INDEX_REQUIRED' })
  await assert.doesNotReject(requireAppointmentSlotIndex(collectionStub([], [requiredIndex])))
})

test('slot audit detects equivalent legacy time formats and reports only record IDs', async () => {
  const inspection = await inspectAppointmentSlots([record('one'), record('two', '9:30 am')])
  assert.deepEqual(inspection, { conflictingRecordIds: [['one', 'two']], invalidRecordIds: ['two'] })
})

test('read-only migration check never builds an index', async () => {
  const collection = collectionStub([record('one')])
  const result = await auditAppointmentSlotIndex(collection)
  assert.equal(result.indexInstalled, false)
  assert.deepEqual(result.conflictingRecordIds, [])
  assert.equal(collection.writes.length, 0)
})

test('migration refuses duplicate or noncanonical slots without any writes', async () => {
  for (const records of [[record('one'), record('two')], [record('one', '9:30 AM')]]) {
    const collection = collectionStub(records)
    const result = await migrateAppointmentSlotIndex(collection)
    assert.equal(result.applied, false)
    assert.equal(collection.writes.length, 0)
  }
})

test('clean migration creates and verifies the unique partial index without editing appointments', async () => {
  const collection = collectionStub([record('one'), record('two', '10:30 AM')])
  const result = await migrateAppointmentSlotIndex(collection)
  assert.equal(result.applied, true)
  assert.equal(result.indexInstalled, true)
  assert.deepEqual(collection.writes, [{ keys: APPOINTMENT_SLOT_INDEX_KEYS, options: APPOINTMENT_SLOT_INDEX_OPTIONS }])
})

test('migration does not report success when a concurrent duplicate prevents index creation', async () => {
  const collection = collectionStub([record('one')])
  collection.createIndex = async () => { throw Object.assign(new Error('Duplicate key'), { code: 11000 }) }
  await assert.rejects(migrateAppointmentSlotIndex(collection), { code: 11000 })
})
