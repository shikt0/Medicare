import mongoose from 'mongoose'

export const APPLICANT_STATUSES = ['applied', 'reviewing', 'shortlisted', 'rejected', 'hired']

const applicantSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOpening', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
  phone: { type: String, required: true, trim: true, maxlength: 40 },
  qualification: { type: String, trim: true, maxlength: 1000, default: '' },
  experience: { type: String, trim: true, maxlength: 2000, default: '' },
  cvUrl: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: APPLICANT_STATUSES, default: 'applied', index: true },
  appliedAt: { type: Date, default: Date.now, index: true },
  reviewedBy: { type: String, default: '' },
}, { timestamps: true })

applicantSchema.index({ jobId: 1, email: 1 }, { unique: true })
applicantSchema.index({ status: 1, appliedAt: -1 })
const Applicant = mongoose.models.Applicant || mongoose.model('Applicant', applicantSchema)
export default Applicant
