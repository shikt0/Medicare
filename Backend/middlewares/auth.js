import { getAuth } from '@clerk/express'
import { clerkClient } from '@clerk/clerk-sdk-node'
import jwt from 'jsonwebtoken'
import Doctor from '../models/Doctor.js'
import Staff from '../models/Staff.js'

export const APP_ROLES = ['patient', 'doctor', 'admin', 'nurse', 'pathologist', 'hr', 'freelancer']
const STAFF_ROLES = new Set(['nurse', 'pathologist', 'hr', 'freelancer'])
const CLERK_CACHE_TTL_MS = 30_000
const clerkUserCache = new Map()

export function isLocalAdminRequest(req) {
  if (process.env.NODE_ENV === 'production') return false
  const origin = String(req.get?.('origin') || '').replace(/\/$/, '')
  return origin === 'http://localhost:5174' || origin === 'http://127.0.0.1:5174'
}

function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase()
  return APP_ROLES.includes(role) ? role : ''
}

function clerkAuth(req) {
  try {
    return getAuth(req)
  } catch {
    return null
  }
}

async function getClerkUser(userId) {
  const cached = clerkUserCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.user

  const user = await clerkClient.users.getUser(userId)
  clerkUserCache.set(userId, { user, expiresAt: Date.now() + CLERK_CACHE_TTL_MS })
  return user
}

function clerkEmail(user) {
  const primary = user?.emailAddresses?.find((item) => item.id === user.primaryEmailAddressId)
    || user?.emailAddresses?.[0]
  return primary?.emailAddress || ''
}

function isVerifiedEmail(user, email) {
  const normalized = String(email || '').trim().toLowerCase()
  return Boolean(user?.emailAddresses?.some((item) => (
    String(item.emailAddress || '').trim().toLowerCase() === normalized
    && item.verification?.status === 'verified'
  )))
}

async function resolveClerkActor(req, userId) {
  const [staff, clerkUser] = await Promise.all([
    Staff.findOne({ authUserId: userId }).lean(),
    getClerkUser(userId),
  ])

  const metadataRole = normalizeRole(clerkUser?.publicMetadata?.role)
  const isAdmin = metadataRole === 'admin'
  const role = isAdmin ? 'admin' : (STAFF_ROLES.has(staff?.role) ? staff.role : 'patient')

  return {
    id: userId,
    authUserId: userId,
    authType: 'clerk',
    role,
    name: staff?.name || [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') || '',
    email: staff?.email || clerkEmail(clerkUser),
    staffId: staff?._id ? String(staff._id) : null,
    staff: staff || null,
    clerkUser,
    emailVerified: isVerifiedEmail(clerkUser, staff?.email || clerkEmail(clerkUser)),
  }
}

async function resolveDoctorActor(req, token) {
  const secret = process.env.JWT_SECRET
  if (!secret || !token) return null

  const payload = jwt.verify(token, secret)
  if (payload.role !== 'doctor' || !payload.id) return null

  const doctor = await Doctor.findById(payload.id).select('-password')
  if (!doctor) return null

  req.doctor = doctor
  return {
    id: String(doctor._id),
    authType: 'jwt',
    role: 'doctor',
    name: doctor.name || '',
    email: doctor.email || '',
    doctor,
  }
}

async function resolveStaffActor(token) {
  const secret = process.env.JWT_SECRET
  if (!secret || !token) return null

  const payload = jwt.verify(token, secret)
  if (payload.type !== 'staff' || !STAFF_ROLES.has(payload.role) || !payload.id) return null

  const staff = await Staff.findById(payload.id).lean()
  if (!staff || !STAFF_ROLES.has(staff.role)) return null
  if (staff.role !== payload.role) return null
  const passwordSetAtSeconds = staff.passwordSetAt ? Math.floor(new Date(staff.passwordSetAt).getTime() / 1000) : 0
  if (passwordSetAtSeconds && payload.iat < passwordSetAtSeconds) return null

  return {
    id: String(staff._id),
    authType: 'jwt',
    role: staff.role,
    name: staff.name || '',
    email: staff.email || '',
    staffId: String(staff._id),
    staff,
  }
}

export async function authenticateActor(req, res, next) {
  try {
    if (req.actor) return next()

    const auth = clerkAuth(req)
    if (auth?.userId) {
      req.actor = await resolveClerkActor(req, auth.userId)
      if (req.actor.staff) req.staff = req.actor.staff
      return next()
    }

    const token = bearerToken(req)
    let actor = null
    try {
      actor = await resolveDoctorActor(req, token)
    } catch {
      actor = null
    }
    if (!actor) {
      try {
        actor = await resolveStaffActor(token)
      } catch {
        actor = null
      }
    }
    if (actor) {
      req.actor = actor
      if (actor.staff) req.staff = actor.staff
      return next()
    }

    if (isLocalAdminRequest(req)) {
      req.actor = {
        id: 'local-development-admin',
        authType: 'local-development',
        role: 'admin',
        name: 'Local Administrator',
        email: 'local-admin@medicare.test',
        staffId: null,
        staff: null,
      }
      return next()
    }

    return res.status(401).json({ success: false, message: 'Authentication required' })
  } catch (error) {
    console.error('authenticateActor error:', error)
    return res.status(503).json({ success: false, message: 'Unable to verify your account right now' })
  }
}

export function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles.map((role) => normalizeRole(role)).filter(Boolean))
  return function roleMiddleware(req, res, next) {
    if (!req.actor) {
      return res.status(401).json({ success: false, message: 'Authentication required' })
    }
    if (!allowed.has(req.actor.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this resource' })
    }
    if (req.actor.staff?.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'This staff account is inactive' })
    }
    return next()
  }
}

export function publicActor(actor) {
  if (!actor) return null
  const value = {
    id: actor.id,
    authType: actor.authType || '',
    authUserId: actor.authUserId || null,
    role: actor.role,
    name: actor.name || '',
    email: actor.email || '',
    staffId: actor.staffId || null,
  }
  if (actor.staff) value.staff = sanitizeStaff(actor.staff)
  return value
}

export function sanitizeStaff(staff) {
  const value = staff?.toObject ? staff.toObject() : { ...staff }
  value.id = String(value._id || value.id || '')
  value.loginEnabled = Boolean(value.passwordSetAt || value.password)
  value.accountLinked = value.loginEnabled
  delete value.password
  delete value.authUserId
  delete value.createdBy
  delete value.updatedBy
  delete value.__v
  return value
}

export function clearClerkUserCache(userId) {
  if (userId) clerkUserCache.delete(userId)
}
