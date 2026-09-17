import mongoose from 'mongoose'

export const LAB_PRIORITIES = ['normal', 'urgent']
export const LAB_STATUSES = ['ordered', 'sample-collected', 'processing', 'completed', 'cancelled']

const labTestOrderSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, required: true, trim: true, maxlength: 120 },
  patientAge: { type: Number, min: 0, max: 130, default: null },
  patientGender: { type: String, trim: true, maxlength: 30, default: '' },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  doctorName: { type: String, required: true, trim: true, maxlength: 120 },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true },
  testName: { type: String, required: true, trim: true, maxlength: 180 },
  testCategory: { type: String, trim: true, maxlength: 120, default: '' },
  clinicalNote: { type: String, trim: true, maxlength: 1500, default: '' },
  priority: { type: String, enum: LAB_PRIORITIES, default: 'normal', index: true },
  sampleType: { type: String, required: true, trim: true, maxlength: 120 },
  assignedPathologist: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null, index: true },
  status: { type: String, enum: LAB_STATUSES, default: 'ordered', index: true },
  result: { type: String, trim: true, maxlength: 5000, default: '' },
  resultNotes: { type: String, trim: true, maxlength: 3000, default: '' },
  orderedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date, default: null },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, default: '' },
}, { timestamps: true })

labTestOrderSchema.index({ assignedPathologist: 1, status: 1, orderedAt: -1 })
labTestOrderSchema.index({ doctorId: 1, status: 1, orderedAt: -1 })
labTestOrderSchema.index({ patientId: 1, status: 1, orderedAt: -1 })

const LabTestOrder = mongoose.models.LabTestOrder || mongoose.model('LabTestOrder', labTestOrderSchema)
export default LabTestOrder
