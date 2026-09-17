import Announcement, { ANNOUNCEMENT_PRIORITIES, ANNOUNCEMENT_TARGETS } from '../models/Announcement.js'
import Staff, { STAFF_ROLES } from '../models/Staff.js'
import { cleanString, isObjectId } from '../utils/validation.js'

function values(body) {
  return {
    title: cleanString(body?.title, 180),
    message: cleanString(body?.message, 5000),
    targetType: cleanString(body?.targetType || 'all').toLowerCase(),
    targetRole: cleanString(body?.targetRole).toLowerCase(),
    targetDepartment: cleanString(body?.targetDepartment, 120),
    targetStaffId: body?.targetStaffId || null,
    priority: cleanString(body?.priority || 'normal').toLowerCase(),
  }
}

function validate(data) {
  if (!data.title || !data.message) return 'Title and message are required'
  if (!ANNOUNCEMENT_TARGETS.includes(data.targetType)) return 'Invalid audience type'
  if (!ANNOUNCEMENT_PRIORITIES.includes(data.priority)) return 'Invalid announcement priority'
  if (data.targetType === 'role' && !STAFF_ROLES.includes(data.targetRole)) return 'Choose a valid target role'
  if (data.targetType === 'department' && !data.targetDepartment) return 'Target department is required'
  if (data.targetType === 'individual' && !isObjectId(data.targetStaffId)) return 'Choose a valid staff member'
  return ''
}

function relevantFilter(actor) {
  return {
    $or: [
      { targetType: 'all' },
      { targetType: 'role', targetRole: actor.role },
      { targetType: 'department', targetDepartment: actor.staff?.department || '' },
      { targetType: 'individual', targetStaffId: actor.staffId },
    ],
  }
}

export async function listAnnouncements(req, res) {
  try {
    const items = await Announcement.find().populate('targetStaffId', 'employeeId name role').sort({ createdAt: -1 }).limit(300).lean()
    return res.json({ success: true, data: items })
  } catch (error) {
    console.error('listAnnouncements error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load announcements' })
  }
}

export async function getMyAnnouncements(req, res) {
  try {
    const items = await Announcement.find(relevantFilter(req.actor)).sort({ createdAt: -1 }).limit(200).lean()
    const staffId = String(req.actor.staffId)
    const data = items.map((item) => ({ ...item, isRead: item.readBy.some((id) => String(id) === staffId), readBy: undefined }))
    return res.json({ success: true, data })
  } catch (error) {
    console.error('getMyAnnouncements error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load your announcements' })
  }
}

export async function createAnnouncement(req, res) {
  try {
    const data = values(req.body)
    const message = validate(data)
    if (message) return res.status(400).json({ success: false, message })
    if (data.targetType === 'individual' && !await Staff.exists({ _id: data.targetStaffId })) {
      return res.status(404).json({ success: false, message: 'Target staff member not found' })
    }
    const item = await Announcement.create({ ...data, createdBy: req.actor.id, createdByName: req.actor.name })
    return res.status(201).json({ success: true, data: item, message: 'Announcement published' })
  } catch (error) {
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('createAnnouncement error:', error)
    return res.status(500).json({ success: false, message: 'Unable to publish the announcement' })
  }
}

export async function updateAnnouncement(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid announcement identifier' })
    const data = values(req.body)
    const message = validate(data)
    if (message) return res.status(400).json({ success: false, message })
    const item = await Announcement.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true })
    if (!item) return res.status(404).json({ success: false, message: 'Announcement not found' })
    return res.json({ success: true, data: item, message: 'Announcement updated' })
  } catch (error) {
    console.error('updateAnnouncement error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update the announcement' })
  }
}

export async function deleteAnnouncement(req, res) {
  if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid announcement identifier' })
  const item = await Announcement.findByIdAndDelete(req.params.id)
  if (!item) return res.status(404).json({ success: false, message: 'Announcement not found' })
  return res.json({ success: true, message: 'Announcement deleted' })
}

export async function markAnnouncementRead(req, res) {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid announcement identifier' })
    const eligible = await Announcement.exists({ _id: req.params.id, ...relevantFilter(req.actor) })
    if (!eligible) return res.status(404).json({ success: false, message: 'Announcement not found' })
    await Announcement.updateOne({ _id: req.params.id }, { $addToSet: { readBy: req.actor.staffId } })
    return res.json({ success: true, message: 'Announcement marked as read' })
  } catch (error) {
    console.error('markAnnouncementRead error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update the announcement' })
  }
}

export { relevantFilter }
