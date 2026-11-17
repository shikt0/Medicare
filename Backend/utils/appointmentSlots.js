import { normalizeTimeSlot, weekdayKeyForDate } from './weeklySchedule.js'

export const ACTIVE_APPOINTMENT_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Rescheduled']
export const APPOINTMENT_SLOT_INDEX_NAME = 'unique_active_doctor_appointment_slot'
export const APPOINTMENT_SLOT_INDEX_KEYS = { doctorId: 1, date: 1, time: 1 }
export const APPOINTMENT_SLOT_INDEX_OPTIONS = {
  name: APPOINTMENT_SLOT_INDEX_NAME,
  unique: true,
  partialFilterExpression: { status: { $in: ACTIVE_APPOINTMENT_STATUSES } },
}

export function isAppointmentSlotIndex(index) {
  const statuses = index.partialFilterExpression?.status?.$in
  return index.name === APPOINTMENT_SLOT_INDEX_NAME
    && index.unique === true
    && JSON.stringify(index.key) === JSON.stringify(APPOINTMENT_SLOT_INDEX_KEYS)
    && Object.keys(index.partialFilterExpression || {}).length === 1
    && Object.keys(index.partialFilterExpression?.status || {}).length === 1
    && Array.isArray(statuses)
    && statuses.length === ACTIVE_APPOINTMENT_STATUSES.length
    && ACTIVE_APPOINTMENT_STATUSES.every((status) => statuses.includes(status))
}

export async function requireAppointmentSlotIndex(collection) {
  try {
    const indexes = await collection.listIndexes().toArray()
    if (indexes.some(isAppointmentSlotIndex)) return
  } catch {
    // A missing collection, index permission, or database connection cannot safely accept bookings.
  }
  const error = new Error('Install the required appointment slot index with npm run db:migrate:appointment-slots')
  error.code = 'BOOKING_INDEX_REQUIRED'
  throw error
}

export function handleAppointmentSlotError(error, res) {
  if (error?.code === 11000) {
    res.status(409).json({ success: false, code: 'APPOINTMENT_SLOT_TAKEN', message: 'This appointment time has already been booked. Please choose another time.' })
    return true
  }
  if (error?.code === 'BOOKING_INDEX_REQUIRED') {
    res.status(503).json({ success: false, code: error.code, message: 'Appointment booking is temporarily unavailable. Please contact the clinic or try again later.' })
    return true
  }
  return false
}

export async function inspectAppointmentSlots(records) {
  const firstBySlot = new Map()
  const conflicts = new Map()
  const invalidRecordIds = []
  for await (const record of records) {
    const id = String(record._id)
    const normalizedTime = normalizeTimeSlot(record.time)
    if (!record.doctorId || !weekdayKeyForDate(record.date) || !normalizedTime || normalizedTime !== record.time) {
      invalidRecordIds.push(id)
    }
    const slot = `${record.doctorId}|${record.date}|${normalizedTime}`
    if (firstBySlot.has(slot)) {
      if (!conflicts.has(slot)) conflicts.set(slot, [firstBySlot.get(slot)])
      conflicts.get(slot).push(id)
    } else firstBySlot.set(slot, id)
  }
  return { conflictingRecordIds: [...conflicts.values()], invalidRecordIds }
}

export async function migrateAppointmentSlotIndex(collection) {
  const inspection = await auditAppointmentSlotIndex(collection)
  if (inspection.conflictingRecordIds.length || inspection.invalidRecordIds.length) {
    return { applied: false, ...inspection }
  }
  // MongoDB checks uniqueness during the build too; a concurrent write causes failure, never deletion.
  await collection.createIndex(APPOINTMENT_SLOT_INDEX_KEYS, APPOINTMENT_SLOT_INDEX_OPTIONS)
  await requireAppointmentSlotIndex(collection)
  return { applied: true, ...inspection, indexInstalled: true }
}

export async function auditAppointmentSlotIndex(collection) {
  const records = collection.find({ status: { $in: ACTIVE_APPOINTMENT_STATUSES } }, { projection: { _id: 1, doctorId: 1, date: 1, time: 1 } })
  const inspection = await inspectAppointmentSlots(records)
  let indexInstalled = false
  try {
    indexInstalled = (await collection.listIndexes().toArray()).some(isAppointmentSlotIndex)
  } catch (error) {
    if (error.code !== 26) throw error // A new database may not have the collection yet.
  }
  return { ...inspection, indexInstalled }
}
