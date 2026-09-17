import FreelancerAssignment, { ASSIGNMENT_STATUSES } from '../models/FreelancerAssignment.js'
import Staff from '../models/Staff.js'
import { cleanString, isDateKey, isObjectId, isTime24, pagination, timeMinutes } from '../utils/validation.js'

const OWNER_TRANSITIONS = {
  assigned: ['accepted'],
  accepted: ['in-progress'],
  'in-progress': ['completed'],
  completed: [],
  cancelled: [],
}

function fields(body, fallback = {}) {
  return {
    title: cleanString(body?.title ?? fallback.title, 180),
    description: cleanString(body?.description ?? fallback.description, 5000),
    department: cleanString(body?.department ?? fallback.department, 120),
    date: cleanString(body?.date ?? fallback.date),
    startTime: cleanString(body?.startTime ?? fallback.startTime),
    endTime: cleanString(body?.endTime ?? fallback.endTime),
    location: cleanString(body?.location ?? fallback.location, 300),
    notes: cleanString(body?.notes ?? fallback.notes, 2000),
  }
}

function validate(data) {
  if (!data.title || !data.description || !data.department) return 'Title, description, and department are required'
  if (!isDateKey(data.date)) return 'Date must use YYYY-MM-DD format'
  if (!isTime24(data.startTime) || !isTime24(data.endTime) || timeMinutes(data.endTime) <= timeMinutes(data.startTime)) return 'Choose a valid start and end time'
  return ''
}

export async function listAssignments(req, res) {
  try {
    const filter = {}
    if (req.query.freelancerId) filter.freelancerId = req.query.freelancerId
    if (req.query.status) filter.status = cleanString(req.query.status).toLowerCase()
    const { page, limit, skip } = pagination(req.query)
    const [items, total] = await Promise.all([
      FreelancerAssignment.find(filter).populate('freelancerId', 'employeeId name email department designation imageUrl status').sort({ date: 1 }).skip(skip).limit(limit).lean(),
      FreelancerAssignment.countDocuments(filter),
    ])
    return res.json({ success: true, data: items, meta: { page, limit, total, count: items.length } })
  } catch (error) {
    console.error('listAssignments error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load freelancer assignments' })
  }
}

export async function getMyAssignments(req, res) {
  try {
    const filter = { freelancerId: req.actor.staffId }
    if (req.query.status) filter.status = cleanString(req.query.status).toLowerCase()
    const items = await FreelancerAssignment.find(filter).sort({ date: 1, startTime: 1 }).lean()
    return res.json({ success: true, data: items })
  } catch (error) {
    console.error('getMyAssignments error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load your assignments' })
  }
}

export async function getAssignment(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid assignment identifier' })
  const assignment = await FreelancerAssignment.findById(req.params.id).populate('freelancerId', 'employeeId name email department designation')
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' })
  if (req.actor.role === 'freelancer' && String(assignment.freelancerId?._id || assignment.freelancerId) !== String(req.actor.staffId)) {
    return res.status(404).json({ success: false, message: 'Assignment not found' })
  }
  return res.json({ success: true, data: assignment })
}

export async function createAssignment(req, res) {
  try {
    const freelancerId = cleanString(req.body?.freelancerId)
    if (!isObjectId(freelancerId)) return res.status(400).json({ success: false, message: 'Choose a valid freelancer' })
    const freelancer = await Staff.findOne({ _id: freelancerId, role: 'freelancer', status: 'active' })
    if (!freelancer) return res.status(404).json({ success: false, message: 'Active freelancer not found' })
    const data = fields(req.body)
    const message = validate(data)
    if (message) return res.status(400).json({ success: false, message })
    const item = await FreelancerAssignment.create({ ...data, freelancerId, assignedBy: req.actor.id })
    return res.status(201).json({ success: true, data: item, message: 'Freelancer assignment created' })
  } catch (error) {
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('createAssignment error:', error)
    return res.status(500).json({ success: false, message: 'Unable to create the assignment' })
  }
}

export async function updateAssignment(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid assignment identifier' })
    const item = await FreelancerAssignment.findById(req.params.id)
    if (!item) return res.status(404).json({ success: false, message: 'Assignment not found' })
    const data = fields(req.body, item)
    const message = validate(data)
    if (message) return res.status(400).json({ success: false, message })
    Object.assign(item, data)
    if (req.body.freelancerId !== undefined) {
      if (!isObjectId(req.body.freelancerId) || !await Staff.exists({ _id: req.body.freelancerId, role: 'freelancer', status: 'active' })) {
        return res.status(400).json({ success: false, message: 'Choose a valid active freelancer' })
      }
      item.freelancerId = req.body.freelancerId
    }
    item.assignedBy = req.actor.id
    await item.save()
    return res.json({ success: true, data: item, message: 'Assignment updated' })
  } catch (error) {
    console.error('updateAssignment error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update the assignment' })
  }
}

export async function updateAssignmentStatus(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid assignment identifier' })
    const status = cleanString(req.body?.status).toLowerCase()
    if (!ASSIGNMENT_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid assignment status' })
    const item = await FreelancerAssignment.findById(req.params.id)
    if (!item) return res.status(404).json({ success: false, message: 'Assignment not found' })
    if (req.actor.role === 'freelancer') {
      if (String(item.freelancerId) !== String(req.actor.staffId)) return res.status(404).json({ success: false, message: 'Assignment not found' })
      if (!OWNER_TRANSITIONS[item.status].includes(status)) return res.status(409).json({ success: false, message: `Cannot move a ${item.status} assignment to ${status}` })
    } else if (['completed', 'cancelled'].includes(item.status) && status !== item.status) {
      return res.status(409).json({ success: false, message: 'Finalized assignments cannot be reopened' })
    }
    item.status = status
    await item.save()
    return res.json({ success: true, data: item, message: `Assignment marked ${status}` })
  } catch (error) {
    console.error('updateAssignmentStatus error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update assignment status' })
  }
}

export { OWNER_TRANSITIONS }
