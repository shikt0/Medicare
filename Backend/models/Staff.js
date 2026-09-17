import mongoose from 'mongoose'

export const STAFF_ROLES = ['nurse', 'pathologist', 'hr', 'freelancer']
export const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'freelance']
export const STAFF_STATUSES = ['active', 'inactive', 'on-leave']

const emergencyContactSchema = new mongoose.Schema({
  name: { type: String, trim: true, maxlength: 120, default: '' },
  relationship: { type: String, trim: true, maxlength: 80, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
}, { _id: false })

const staffSchema = new mongoose.Schema({
  authUserId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    default: undefined,
  },
  employeeId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true,
    maxlength: 40,
  },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    maxlength: 180,
  },
  password: {
    type: String,
    select: false,
    default: undefined,
  },
  passwordSetAt: { type: Date, default: null },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  imageUrl: { type: String, trim: true, maxlength: 1000, default: '' },
  imagePublicId: { type: String, trim: true, maxlength: 300, default: '' },
  role: { type: String, required: true, enum: STAFF_ROLES, index: true },
  department: { type: String, trim: true, maxlength: 120, default: '', index: true },
  designation: { type: String, trim: true, maxlength: 120, default: '' },
  qualification: { type: String, trim: true, maxlength: 500, default: '' },
  joiningDate: { type: Date, default: null },
  employmentType: {
    type: String,
    enum: EMPLOYMENT_TYPES,
    default: 'full-time',
  },
  status: { type: String, enum: STAFF_STATUSES, default: 'active', index: true },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  emergencyContact: { type: emergencyContactSchema, default: () => ({}) },
  createdBy: { type: String, default: '', select: false },
  updatedBy: { type: String, default: '', select: false },
}, { timestamps: true })

staffSchema.index({ role: 1, status: 1 })
staffSchema.index({ department: 1, status: 1 })
staffSchema.index({ name: 'text', email: 'text', employeeId: 'text', department: 'text' })

const Staff = mongoose.models.Staff || mongoose.model('Staff', staffSchema)

export default Staff
