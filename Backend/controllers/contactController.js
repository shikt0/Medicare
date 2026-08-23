import { getAuth } from '@clerk/express'
import ContactMessage from '../models/ContactMessage.js'

export async function createContactMessage(req, res) {
  try {
    const { name, email, mobile = '', subject, message } = req.body || {}
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Name, email, subject, and message are required.' })
    }
    if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' })
    }

    let createdBy = null
    try { createdBy = getAuth(req)?.userId || req.auth?.userId || null } catch { createdBy = null }

    const data = await ContactMessage.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      mobile: String(mobile || '').trim(),
      subject: String(subject).trim(),
      message: String(message).trim(),
      createdBy,
    })
    return res.status(201).json({ success: true, data: { id: data._id, createdAt: data.createdAt }, message: 'Your message has been received.' })
  } catch (error) {
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('createContactMessage error:', error)
    return res.status(500).json({ success: false, message: 'Unable to send your message right now.' })
  }
}
