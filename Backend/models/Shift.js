import mongoose from 'mongoose'
import { STAFF_ROLES } from './Staff.js'

export const SHIFT_STATUSES = ['scheduled', 'completed', 'cancelled', 'on-leave']

const shiftSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  role: { type: String, enum: STAFF_ROLES, required: true, index: true },
  date: { type: String, required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  department: { type: String, trim: true, maxlength: 120, default: '', index: true },
  ward: { type: String, trim: true, maxlength: 120, default: '' },
  appointmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }],
  assignedBy: { type: String, required: true },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: SHIFT_STATUSES, default: 'scheduled', index: true },
}, { timestamps: true })

shiftSchema.index({ staffId: 1, date: 1, startTime: 1 })
shiftSchema.index({ date: 1, status: 1, department: 1 })

const Shift = mongoose.models.Shift || mongoose.model('Shift', shiftSchema)
export default Shift
