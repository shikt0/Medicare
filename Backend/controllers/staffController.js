import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'node:fs'
import Staff, { EMPLOYMENT_TYPES, STAFF_ROLES, STAFF_STATUSES } from '../models/Staff.js'
import { sanitizeStaff } from '../middlewares/auth.js'
import { deleteFromCloudinary, uploadToCloudinary } from '../utils/cloudinary.js'

const ADMIN_FIELDS = [
  'employeeId', 'name', 'email', 'password', 'phone', 'imageUrl', 'role', 'department',
  'designation', 'qualification', 'joiningDate', 'employmentType', 'status',
  'address', 'emergencyContact',
]
const SELF_FIELDS = ['name', 'phone', 'imageUrl', 'address', 'emergencyContact']
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function cleanEmergencyContact(value) {
  let contact = value
  if (typeof contact === 'string') {
    try { contact = JSON.parse(contact) } catch { contact = {} }
  }
  contact = contact && typeof contact === 'object' ? contact : {}
  return {
    name: cleanString(contact.name),
    relationship: cleanString(contact.relationship),
    phone: cleanString(contact.phone),
  }
}

function dateValue(value) {
  if (value === '' || value === null) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function normalizeFields(body, allowedFields) {
  const update = {}
  allowedFields.forEach((field) => {
    if (body[field] === undefined) return
    if (field === 'emergencyContact') update[field] = cleanEmergencyContact(body[field])
    else if (field === 'joiningDate') update[field] = dateValue(body[field])
    else if (field === 'password') update[field] = String(body[field] ?? '')
    else update[field] = typeof body[field] === 'string' ? cleanString(body[field]) : body[field]
  })

  if (update.employeeId !== undefined) update.employeeId = update.employeeId.toUpperCase()
  if (update.email !== undefined) update.email = update.email.toLowerCase()
  if (update.role !== undefined) update.role = update.role.toLowerCase()
  if (update.employmentType !== undefined) update.employmentType = update.employmentType.toLowerCase()
  if (update.status !== undefined) update.status = update.status.toLowerCase()
  return update
}

function validateStaffFields(values, { creating = false } = {}) {
  if (creating) {
    const missing = ['employeeId', 'name', 'email', 'password', 'role'].filter((field) => !values[field])
    if (missing.length) return `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required`
  }
  if (values.email !== undefined && !EMAIL_PATTERN.test(values.email)) return 'Enter a valid email address'
  if (values.password !== undefined && values.password.length < 8) return 'Staff password must contain at least 8 characters'
  if (values.password !== undefined && values.password.length > 72) return 'Staff password cannot exceed 72 characters'
  if (values.role !== undefined && !STAFF_ROLES.includes(values.role)) return 'Invalid staff role'
  if (values.employmentType !== undefined && !EMPLOYMENT_TYPES.includes(values.employmentType)) return 'Invalid employment type'
  if (values.status !== undefined && !STAFF_STATUSES.includes(values.status)) return 'Invalid staff status'
  if (values.joiningDate === undefined && Object.prototype.hasOwnProperty.call(values, 'joiningDate')) return 'Enter a valid joining date'
  return ''
}

async function hashStaffPassword(values) {
  if (values.password === undefined) return
  values.password = await bcrypt.hash(values.password, 12)
  values.passwordSetAt = new Date()
}

function invalidId(res) {
  return res.status(400).json({ success: false, message: 'Invalid staff identifier' })
}

function duplicateMessage(error) {
  const field = Object.keys(error?.keyPattern || {})[0]
  if (field === 'employeeId') return 'Employee ID is already in use'
  if (field === 'email') return 'Email address is already in use'
  if (field === 'authUserId') return 'This login account is already linked to another staff member'
  return 'A staff record with these details already exists'
}

export async function staffLogin(req, res) {
  try {
    const email = cleanString(req.body?.email).toLowerCase()
    const password = String(req.body?.password || '')
    const expectedRole = cleanString(req.body?.role).toLowerCase()

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' })
    }
    if (expectedRole && !STAFF_ROLES.includes(expectedRole)) {
      return res.status(400).json({ success: false, message: 'Invalid staff portal' })
    }

    const staff = await Staff.findOne({ email }).select('+password')
    const storedPassword = String(staff?.password || '')
    const passwordMatches = storedPassword && (storedPassword.startsWith('$2')
      ? await bcrypt.compare(password, storedPassword)
      : storedPassword === password)

    if (!staff || !passwordMatches) {
      return res.status(401).json({ success: false, message: 'The email or password is incorrect' })
    }
    if (staff.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'This staff account is inactive' })
    }
    if (expectedRole && staff.role !== expectedRole) {
      return res.status(403).json({ success: false, message: `This account belongs to the ${staff.role} portal` })
    }

    if (!storedPassword.startsWith('$2')) {
      staff.password = await bcrypt.hash(password, 12)
      staff.passwordSetAt = new Date()
      await staff.save()
    }

    const secret = process.env.JWT_SECRET
    if (!secret) return res.status(500).json({ success: false, message: 'Server authentication is not configured' })

    const token = jwt.sign({
      id: String(staff._id),
      email: staff.email,
      role: staff.role,
      type: 'staff',
    }, secret, { expiresIn: '7d' })

    return res.json({
      success: true,
      token,
      data: sanitizeStaff(staff),
      message: 'Signed in successfully',
    })
  } catch (error) {
    console.error('staffLogin error:', error)
    return res.status(500).json({ success: false, message: 'Unable to sign in right now' })
  }
}

export async function listStaff(req, res) {
  try {
    const {
      q = '', role = '', department = '', status = '',
      page: pageRaw = 1, limit: limitRaw = 50,
    } = req.query
    const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1)
    const limit = Math.min(200, Math.max(1, Number.parseInt(limitRaw, 10) || 50))

    if (role && !STAFF_ROLES.includes(String(role).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid staff role filter' })
    }
    if (status && !STAFF_STATUSES.includes(String(status).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid staff status filter' })
    }

    const filter = {}
    if (role) filter.role = String(role).toLowerCase()
    if (status) filter.status = String(status).toLowerCase()
    if (department) filter.department = new RegExp(`^${escapeRegExp(cleanString(department))}$`, 'i')
    if (cleanString(q)) {
      const expression = new RegExp(escapeRegExp(cleanString(q)), 'i')
      filter.$or = [
        { name: expression }, { email: expression }, { employeeId: expression },
        { phone: expression }, { department: expression }, { designation: expression },
      ]
    }

    const [items, total, departments] = await Promise.all([
      Staff.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Staff.countDocuments(filter),
      Staff.distinct('department', { department: { $ne: '' } }),
    ])

    return res.json({
      success: true,
      data: items.map(sanitizeStaff),
      meta: { page, limit, total, count: items.length },
      facets: { departments: departments.filter(Boolean).sort((a, b) => a.localeCompare(b)) },
    })
  } catch (error) {
    console.error('listStaff error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load staff records' })
  }
}

export async function getStaffStats(req, res) {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const [total, active, onLeave, inactive, recentHires, roleGroups] = await Promise.all([
      Staff.countDocuments(),
      Staff.countDocuments({ status: 'active' }),
      Staff.countDocuments({ status: 'on-leave' }),
      Staff.countDocuments({ status: 'inactive' }),
      Staff.countDocuments({ joiningDate: { $gte: thirtyDaysAgo } }),
      Staff.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ])
    const roles = Object.fromEntries(STAFF_ROLES.map((role) => [role, 0]))
    roleGroups.forEach((item) => {
      if (Object.prototype.hasOwnProperty.call(roles, item._id)) roles[item._id] = item.count
    })
    return res.json({ success: true, data: { total, active, onLeave, inactive, recentHires, roles } })
  } catch (error) {
    console.error('getStaffStats error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load staff statistics' })
  }
}

export async function getStaffById(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res)
    const staff = await Staff.findById(req.params.id).lean()
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' })
    return res.json({ success: true, data: sanitizeStaff(staff) })
  } catch (error) {
    console.error('getStaffById error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load the staff profile' })
  }
}

export async function createStaff(req, res) {
  try {
    const values = normalizeFields(req.body || {}, ADMIN_FIELDS)
    const validationError = validateStaffFields(values, { creating: true })
    if (validationError) return res.status(400).json({ success: false, message: validationError })
    await hashStaffPassword(values)

    const staff = await Staff.create({
      ...values,
      createdBy: req.actor.id,
      updatedBy: req.actor.id,
    })
    return res.status(201).json({ success: true, data: sanitizeStaff(staff), message: 'Staff member added' })
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: duplicateMessage(error) })
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('createStaff error:', error)
    return res.status(500).json({ success: false, message: 'Unable to add staff member' })
  }
}

export async function updateStaff(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res)
    const values = normalizeFields(req.body || {}, ADMIN_FIELDS)
    const validationError = validateStaffFields(values)
    if (validationError) return res.status(400).json({ success: false, message: validationError })
    if (!Object.keys(values).length) {
      return res.status(400).json({ success: false, message: 'No editable staff fields were provided' })
    }

    await hashStaffPassword(values)
    values.updatedBy = req.actor.id
    const staff = await Staff.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true })
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' })
    return res.json({ success: true, data: sanitizeStaff(staff), message: 'Staff profile updated' })
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: duplicateMessage(error) })
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('updateStaff error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update staff member' })
  }
}

export async function updateStaffStatus(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res)
    const status = cleanString(req.body?.status).toLowerCase()
    if (!STAFF_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid staff status' })
    }
    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { $set: { status, updatedBy: req.actor.id } },
      { new: true, runValidators: true },
    )
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' })
    return res.json({ success: true, data: sanitizeStaff(staff), message: `Staff status changed to ${status}` })
  } catch (error) {
    console.error('updateStaffStatus error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update staff status' })
  }
}

export async function deactivateStaff(req, res) {
  req.body = { status: 'inactive' }
  return updateStaffStatus(req, res)
}

export async function getMyStaffProfile(req, res) {
  const staff = await Staff.findById(req.actor.staffId).lean()
  if (!staff) return res.status(404).json({ success: false, message: 'Staff profile not found' })
  return res.json({ success: true, data: sanitizeStaff(staff) })
}

export async function updateMyStaffProfile(req, res) {
  let uploadedPublicId = ''
  try {
    const values = normalizeFields(req.body || {}, SELF_FIELDS)
    const removeImage = String(req.body?.removeImage || '').toLowerCase() === 'true'
    const staff = await Staff.findById(req.actor.staffId)
    if (!staff) return res.status(404).json({ success: false, message: 'Staff profile not found' })

    const previousPublicId = staff.imagePublicId
    if (req.file?.path) {
      const uploaded = await uploadToCloudinary(req.file.path, 'staff')
      values.imageUrl = uploaded?.secure_url || uploaded?.url || ''
      values.imagePublicId = uploaded?.public_id || ''
      uploadedPublicId = values.imagePublicId
    } else if (removeImage) {
      values.imageUrl = ''
      values.imagePublicId = ''
    }

    if (!Object.keys(values).length) {
      return res.status(400).json({ success: false, message: 'No editable profile fields were provided' })
    }
    values.updatedBy = req.actor.id

    staff.set(values)
    await staff.save()

    if (previousPublicId && (req.file || removeImage) && previousPublicId !== staff.imagePublicId) {
      deleteFromCloudinary(previousPublicId).catch((error) => console.error('Unable to remove previous staff image', error))
    }
    return res.json({ success: true, data: sanitizeStaff(staff), message: 'Profile updated' })
  } catch (error) {
    if (uploadedPublicId) {
      deleteFromCloudinary(uploadedPublicId).catch(() => {})
    }
    if (error?.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message })
    console.error('updateMyStaffProfile error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update your profile' })
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path) } catch { /* best-effort temporary file cleanup */ }
    }
  }
}
