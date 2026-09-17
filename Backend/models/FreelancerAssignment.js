import mongoose from 'mongoose'

export const ASSIGNMENT_STATUSES = ['assigned', 'accepted', 'in-progress', 'completed', 'cancelled']

const freelancerAssignmentSchema = new mongoose.Schema({
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  department: { type: String, required: true, trim: true, maxlength: 120, index: true },
  assignedBy: { type: String, required: true },
  date: { type: String, required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  location: { type: String, trim: true, maxlength: 300, default: '' },
  status: { type: String, enum: ASSIGNMENT_STATUSES, default: 'assigned', index: true },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
}, { timestamps: true })

freelancerAssignmentSchema.index({ freelancerId: 1, date: 1, status: 1 })
const FreelancerAssignment = mongoose.models.FreelancerAssignment || mongoose.model('FreelancerAssignment', freelancerAssignmentSchema)
export default FreelancerAssignment
