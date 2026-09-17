import Appointment from '../models/Appointment.js'
import LabTestOrder, { LAB_PRIORITIES, LAB_STATUSES } from '../models/LabTestOrder.js'
import Staff from '../models/Staff.js'
import { cleanString, isObjectId, pagination } from '../utils/validation.js'

const PATHOLOGIST_TRANSITIONS = {
  ordered: ['sample-collected'],
  'sample-collected': ['processing'],
  processing: ['completed'],
  completed: [],
  cancelled: [],
}

function scopedFilter(req) {
  if (req.actor.role === 'doctor') return { doctorId: req.actor.id }
  if (req.actor.role === 'pathologist') return { assignedPathologist: req.actor.staffId }
  if (req.actor.role === 'patient') return { patientId: req.actor.id, status: 'completed' }
  return {}
}

function canView(req, order) {
  if (req.actor.role === 'admin') return true
  if (req.actor.role === 'doctor') return String(order.doctorId) === req.actor.id
  if (req.actor.role === 'pathologist') return String(order.assignedPathologist || '') === String(req.actor.staffId)
  return req.actor.role === 'patient' && order.patientId === req.actor.id && order.status === 'completed'
}

function publicLab(order, role) {
  const value = order?.toObject ? order.toObject() : { ...order }
  if (role === 'patient') {
    delete value.clinicalNote
    delete value.createdBy
    delete value.updatedBy
    delete value.patientId
    delete value.patientAge
    delete value.patientGender
  }
  if (role === 'pathologist') {
    delete value.createdBy
    delete value.updatedBy
  }
  return value
}

export async function listLabTests(req, res) {
  try {
    const filter = { ...scopedFilter(req) }
    if (req.query.status) {
      const status = cleanString(req.query.status).toLowerCase()
      if (!LAB_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid lab status' })
      if (req.actor.role !== 'patient') filter.status = status
    }
    if (req.query.priority) filter.priority = cleanString(req.query.priority).toLowerCase()
    if (req.query.pathologistId && req.actor.role === 'admin') filter.assignedPathologist = req.query.pathologistId
    if (req.query.doctorId && req.actor.role === 'admin') filter.doctorId = req.query.doctorId
    const { page, limit, skip } = pagination(req.query)
    const [items, total] = await Promise.all([
      LabTestOrder.find(filter)
        .populate('assignedPathologist', 'employeeId name department designation')
        .sort({ priority: -1, orderedAt: -1 }).skip(skip).limit(limit).lean(),
      LabTestOrder.countDocuments(filter),
    ])
    return res.json({ success: true, data: items.map((item) => publicLab(item, req.actor.role)), meta: { page, limit, total, count: items.length } })
  } catch (error) {
    console.error('listLabTests error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load laboratory orders' })
  }
}

export async function getLabTest(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid lab order identifier' })
    const order = await LabTestOrder.findById(req.params.id).populate('assignedPathologist', 'employeeId name department designation')
    if (!order || !canView(req, order)) return res.status(404).json({ success: false, message: 'Lab order not found' })
    return res.json({ success: true, data: publicLab(order, req.actor.role) })
  } catch (error) {
    console.error('getLabTest error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load the laboratory order' })
  }
}

export async function createLabTest(req, res) {
  try {
    const appointmentId = cleanString(req.body?.appointmentId)
    if (!isObjectId(appointmentId)) return res.status(400).json({ success: false, message: 'Choose a valid patient appointment' })
    const appointment = await Appointment.findById(appointmentId)
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' })
    if (req.actor.role === 'doctor' && String(appointment.doctorId) !== req.actor.id) {
      return res.status(404).json({ success: false, message: 'Appointment not found' })
    }
    if (!appointment.createdBy) {
      return res.status(400).json({ success: false, message: 'This appointment is not linked to a secure patient account' })
    }
    const testName = cleanString(req.body?.testName, 180)
    const sampleType = cleanString(req.body?.sampleType, 120)
    const priority = cleanString(req.body?.priority || 'normal').toLowerCase()
    if (!testName || !sampleType) return res.status(400).json({ success: false, message: 'Test name and sample type are required' })
    if (!LAB_PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid lab priority' })
    const order = await LabTestOrder.create({
      patientId: appointment.createdBy,
      patientName: appointment.patientName,
      patientAge: appointment.age,
      patientGender: appointment.gender,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName || req.actor.name,
      appointmentId: appointment._id,
      testName,
      testCategory: cleanString(req.body?.testCategory, 120),
      clinicalNote: cleanString(req.body?.clinicalNote, 1500),
      priority,
      sampleType,
      createdBy: req.actor.id,
      updatedBy: req.actor.id,
    })
    return res.status(201).json({ success: true, data: order, message: 'Laboratory test ordered' })
  } catch (error) {
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('createLabTest error:', error)
    return res.status(500).json({ success: false, message: 'Unable to create the laboratory order' })
  }
}

export async function assignPathologist(req, res) {
  try {
    if (!isObjectId(req.params.id) || !isObjectId(req.body?.pathologistId)) {
      return res.status(400).json({ success: false, message: 'Choose a valid order and pathologist' })
    }
    const pathologist = await Staff.findOne({ _id: req.body.pathologistId, role: 'pathologist', status: 'active' })
    if (!pathologist) return res.status(404).json({ success: false, message: 'Active pathologist not found' })
    const order = await LabTestOrder.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: ['completed', 'cancelled'] } },
      { $set: { assignedPathologist: pathologist._id, updatedBy: req.actor.id } },
      { new: true, runValidators: true },
    )
    if (!order) return res.status(404).json({ success: false, message: 'Open laboratory order not found' })
    return res.json({ success: true, data: order, message: 'Pathologist assigned' })
  } catch (error) {
    console.error('assignPathologist error:', error)
    return res.status(500).json({ success: false, message: 'Unable to assign the pathologist' })
  }
}

export async function updateLabStatus(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid lab order identifier' })
    const status = cleanString(req.body?.status).toLowerCase()
    if (!LAB_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid lab status' })
    const order = await LabTestOrder.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: 'Lab order not found' })
    if (req.actor.role === 'pathologist') {
      if (String(order.assignedPathologist || '') !== String(req.actor.staffId)) return res.status(404).json({ success: false, message: 'Lab order not found' })
      if (!PATHOLOGIST_TRANSITIONS[order.status].includes(status)) {
        return res.status(409).json({ success: false, message: `Cannot move a ${order.status} order to ${status}` })
      }
      if (status === 'completed' && !order.result) {
        return res.status(400).json({ success: false, message: 'Enter the test result before completing the order' })
      }
    } else {
      if (status !== 'cancelled') return res.status(403).json({ success: false, message: 'Administrators may monitor or cancel orders; laboratory staff complete results' })
      if (['completed', 'cancelled'].includes(order.status)) return res.status(409).json({ success: false, message: 'Finalized orders cannot be changed' })
    }
    order.status = status
    order.updatedBy = req.actor.id
    order.completedAt = status === 'completed' ? new Date() : null
    await order.save()
    return res.json({ success: true, data: order, message: `Laboratory order marked ${status}` })
  } catch (error) {
    console.error('updateLabStatus error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update the laboratory status' })
  }
}

export async function submitLabResult(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid lab order identifier' })
    const result = cleanString(req.body?.result, 5000)
    if (!result) return res.status(400).json({ success: false, message: 'Test result is required' })
    const order = await LabTestOrder.findOne({ _id: req.params.id, assignedPathologist: req.actor.staffId })
    if (!order) return res.status(404).json({ success: false, message: 'Assigned laboratory order not found' })
    if (['completed', 'cancelled'].includes(order.status)) return res.status(409).json({ success: false, message: 'Finalized orders cannot be changed' })
    order.result = result
    order.resultNotes = cleanString(req.body?.resultNotes, 3000)
    order.updatedBy = req.actor.id
    await order.save()
    return res.json({ success: true, data: order, message: 'Result saved' })
  } catch (error) {
    console.error('submitLabResult error:', error)
    return res.status(500).json({ success: false, message: 'Unable to save the laboratory result' })
  }
}

export { PATHOLOGIST_TRANSITIONS }
