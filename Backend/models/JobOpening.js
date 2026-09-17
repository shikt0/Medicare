import mongoose from 'mongoose'
import { EMPLOYMENT_TYPES } from './Staff.js'

export const JOB_ROLES = ['nurse', 'pathologist', 'hr', 'freelancer', 'other']
export const JOB_STATUSES = ['open', 'closed']

const jobOpeningSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  department: { type: String, required: true, trim: true, maxlength: 120, index: true },
  role: { type: String, enum: JOB_ROLES, required: true, index: true },
  employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  requirements: { type: String, trim: true, maxlength: 3000, default: '' },
  qualification: { type: String, trim: true, maxlength: 1000, default: '' },
  numberOfPositions: { type: Number, min: 1, max: 1000, default: 1 },
  deadline: { type: Date, required: true, index: true },
  status: { type: String, enum: JOB_STATUSES, default: 'open', index: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, default: '' },
}, { timestamps: true })

jobOpeningSchema.index({ status: 1, deadline: 1 })
const JobOpening = mongoose.models.JobOpening || mongoose.model('JobOpening', jobOpeningSchema)
export default JobOpening
