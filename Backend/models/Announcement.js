import mongoose from 'mongoose'
import { STAFF_ROLES } from './Staff.js'

export const ANNOUNCEMENT_TARGETS = ['all', 'role', 'department', 'individual']
export const ANNOUNCEMENT_PRIORITIES = ['normal', 'important', 'urgent']

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  createdBy: { type: String, required: true },
  createdByName: { type: String, trim: true, maxlength: 120, default: '' },
  targetType: { type: String, enum: ANNOUNCEMENT_TARGETS, default: 'all', index: true },
  targetRole: { type: String, enum: [...STAFF_ROLES, ''], default: '' },
  targetDepartment: { type: String, trim: true, maxlength: 120, default: '' },
  targetStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
  priority: { type: String, enum: ANNOUNCEMENT_PRIORITIES, default: 'normal', index: true },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
}, { timestamps: true })

announcementSchema.index({ createdAt: -1, priority: 1 })
const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema)
export default Announcement
