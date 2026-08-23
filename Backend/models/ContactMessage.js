import mongoose from 'mongoose'

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
  mobile: { type: String, trim: true, maxlength: 40, default: '' },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  createdBy: { type: String, default: null, index: true },
  status: { type: String, enum: ['New', 'Read', 'Resolved'], default: 'New', index: true },
}, { timestamps: true })

const ContactMessage = mongoose.models.ContactMessage || mongoose.model('ContactMessage', contactMessageSchema)
export default ContactMessage
