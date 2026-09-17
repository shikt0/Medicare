import Shift, { SHIFT_STATUSES } from '../models/Shift.js'
import Staff from '../models/Staff.js'
import Appointment from '../models/Appointment.js'
import { cleanString, isDateKey, isObjectId, isTime24, pagination, timeMinutes } from '../utils/validation.js'

function invalid(res, message) {
  return res.status(400).json({ success: false, message })
}

function shiftQuery(req) {
  const filter = {}
  if (req.query.staffId) filter.staffId = req.query.staffId
  if (req.query.role) filter.role = cleanString(req.query.role).toLowerCase()
  if (req.query.department) filter.department = cleanString(req.query.department)
  if (req.query.status) filter.status = cleanString(req.query.status).toLowerCase()
  if (req.query.date) filter.date = req.query.date
  if (req.query.from || req.query.to) {
    filter.date = {}
    if (req.query.from) filter.date.$gte = req.query.from
    if (req.query.to) filter.date.$lte = req.query.to
  }
  return filter
}

async function populateShift(query, includeAppointments = false) {
  query.populate('staffId', 'employeeId name role department designation imageUrl status')
  if (includeAppointments) {
    query.populate('appointmentIds', 'patientName age gender mobile date time status doctorName notes')
  } else {
    query.select('-appointmentIds')
  }
  return query.lean()
}

function validateTimes(date, startTime, endTime) {
  if (!isDateKey(date)) return 'Date must use YYYY-MM-DD format'
  if (!isTime24(startTime) || !isTime24(endTime)) return 'Times must use 24-hour HH:mm format'
  if (timeMinutes(endTime) <= timeMinutes(startTime)) return 'End time must be later than start time'
  return ''
}

async function validateAppointmentIds(ids) {
  if (!Array.isArray(ids)) return null
  const unique = [...new Set(ids.map(String))]
  if (unique.some((id) => !isObjectId(id))) return null
  const count = await Appointment.countDocuments({ _id: { $in: unique } })
  return count === unique.length ? unique : null
}

async function hasOverlap(staffId, date, startTime, endTime, excludeId = null) {
  const filter = {
    staffId,
    date,
    status: { $nin: ['cancelled', 'on-leave'] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  }
  if (excludeId) filter._id = { $ne: excludeId }
  return Boolean(await Shift.exists(filter))
}

export async function listShifts(req, res) {
  try {
    const filter = shiftQuery(req)
    if (filter.staffId && !isObjectId(filter.staffId)) return invalid(res, 'Invalid staff identifier')
    if (filter.status && !SHIFT_STATUSES.includes(filter.status)) return invalid(res, 'Invalid shift status')
    const { page, limit, skip } = pagination(req.query)
    const [items, total] = await Promise.all([
      populateShift(Shift.find(filter).sort({ date: 1, startTime: 1 }).skip(skip).limit(limit), req.actor.role === 'admin'),
      Shift.countDocuments(filter),
    ])
    return res.json({ success: true, data: items, meta: { page, limit, total, count: items.length } })
  } catch (error) {
    console.error('listShifts error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load duty schedules' })
  }
}

export async function getMyShifts(req, res) {
  try {
    const filter = { ...shiftQuery(req), staffId: req.actor.staffId }
    const items = await populateShift(
      Shift.find(filter).sort({ date: 1, startTime: 1 }).limit(300),
      req.actor.role === 'nurse',
    )
    return res.json({ success: true, data: items })
  } catch (error) {
    console.error('getMyShifts error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load your schedule' })
  }
}

export async function getShiftById(req, res) {
  try {
    if (!isObjectId(req.params.id)) return invalid(res, 'Invalid shift identifier')
    const shift = await Shift.findById(req.params.id)
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' })
    const ownsShift = String(shift.staffId) === String(req.actor.staffId)
    if (!['admin', 'hr'].includes(req.actor.role) && !ownsShift) {
      return res.status(404).json({ success: false, message: 'Shift not found' })
    }
    const data = await populateShift(Shift.findById(shift._id), req.actor.role === 'admin' || (ownsShift && req.actor.role === 'nurse'))
    return res.json({ success: true, data })
  } catch (error) {
    console.error('getShiftById error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load the shift' })
  }
}

export async function createShift(req, res) {
  try {
    const staffId = cleanString(req.body?.staffId)
    const date = cleanString(req.body?.date)
    const startTime = cleanString(req.body?.startTime)
    const endTime = cleanString(req.body?.endTime)
    if (!isObjectId(staffId)) return invalid(res, 'Choose a valid staff member')
    const timeError = validateTimes(date, startTime, endTime)
    if (timeError) return invalid(res, timeError)
    const staff = await Staff.findById(staffId)
    if (!staff || staff.status === 'inactive') return res.status(404).json({ success: false, message: 'Active staff member not found' })
    if (await hasOverlap(staffId, date, startTime, endTime)) {
      return res.status(409).json({ success: false, message: 'This staff member already has an overlapping shift' })
    }
    let appointmentIds = []
    if (req.body.appointmentIds !== undefined && req.actor.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can attach clinical appointments to duties' })
    }
    if (req.body.appointmentIds !== undefined) {
      appointmentIds = await validateAppointmentIds(req.body.appointmentIds)
      if (!appointmentIds) return invalid(res, 'One or more appointments are invalid')
    }
    const shift = await Shift.create({
      staffId,
      role: staff.role,
      date,
      startTime,
      endTime,
      department: cleanString(req.body?.department || staff.department, 120),
      ward: cleanString(req.body?.ward, 120),
      appointmentIds,
      assignedBy: req.actor.id,
      notes: cleanString(req.body?.notes, 1000),
      status: 'scheduled',
    })
    const data = await populateShift(Shift.findById(shift._id), req.actor.role === 'admin')
    return res.status(201).json({ success: true, data, message: 'Duty assigned' })
  } catch (error) {
    if (error?.name === 'ValidationError') return invalid(res, error.message)
    console.error('createShift error:', error)
    return res.status(500).json({ success: false, message: 'Unable to assign duty' })
  }
}

export async function updateShift(req, res) {
  try {
    if (!isObjectId(req.params.id)) return invalid(res, 'Invalid shift identifier')
    const shift = await Shift.findById(req.params.id)
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' })
    const staffId = cleanString(req.body?.staffId || shift.staffId)
    const date = cleanString(req.body?.date ?? shift.date)
    const startTime = cleanString(req.body?.startTime ?? shift.startTime)
    const endTime = cleanString(req.body?.endTime ?? shift.endTime)
    const timeError = validateTimes(date, startTime, endTime)
    if (!isObjectId(staffId) || timeError) return invalid(res, timeError || 'Choose a valid staff member')
    const staff = await Staff.findById(staffId)
    if (!staff || staff.status === 'inactive') return res.status(404).json({ success: false, message: 'Active staff member not found' })
    if (await hasOverlap(staffId, date, startTime, endTime, shift._id)) {
      return res.status(409).json({ success: false, message: 'This staff member already has an overlapping shift' })
    }
    if (req.body.appointmentIds !== undefined && req.actor.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can attach clinical appointments to duties' })
    }
    if (req.body.appointmentIds !== undefined) {
      const ids = await validateAppointmentIds(req.body.appointmentIds)
      if (!ids) return invalid(res, 'One or more appointments are invalid')
      shift.appointmentIds = ids
    }
    const status = req.body.status === undefined ? shift.status : cleanString(req.body.status).toLowerCase()
    if (!SHIFT_STATUSES.includes(status)) return invalid(res, 'Invalid shift status')
    Object.assign(shift, {
      staffId, role: staff.role, date, startTime, endTime, status,
      department: cleanString(req.body?.department ?? shift.department, 120),
      ward: cleanString(req.body?.ward ?? shift.ward, 120),
      notes: cleanString(req.body?.notes ?? shift.notes, 1000),
      assignedBy: req.actor.id,
    })
    await shift.save()
    const data = await populateShift(Shift.findById(shift._id), req.actor.role === 'admin')
    return res.json({ success: true, data, message: 'Duty updated' })
  } catch (error) {
    if (error?.name === 'ValidationError') return invalid(res, error.message)
    console.error('updateShift error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update duty' })
  }
}

export async function cancelShift(req, res) {
  try {
    if (!isObjectId(req.params.id)) return invalid(res, 'Invalid shift identifier')
    const shift = await Shift.findByIdAndUpdate(req.params.id, { $set: { status: 'cancelled', assignedBy: req.actor.id } }, { new: true })
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' })
    return res.json({ success: true, data: shift, message: 'Duty cancelled' })
  } catch (error) {
    console.error('cancelShift error:', error)
    return res.status(500).json({ success: false, message: 'Unable to cancel duty' })
  }
}
