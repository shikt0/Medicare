import Staff from '../models/Staff.js'
import { clearClerkUserCache, publicActor, sanitizeStaff } from '../middlewares/auth.js'

function verifiedEmails(user) {
  return (user?.emailAddresses || [])
    .filter((item) => item.verification?.status === 'verified')
    .map((item) => String(item.emailAddress || '').trim().toLowerCase())
    .filter(Boolean)
}

export function getCurrentActor(req, res) {
  return res.json({ success: true, data: publicActor(req.actor) })
}

export async function claimStaffAccount(req, res) {
  try {
    if (req.actor.authType !== 'clerk') {
      return res.status(400).json({ success: false, message: 'Staff accounts must be linked with Clerk' })
    }
    if (req.actor.role === 'admin') {
      return res.json({ success: true, data: publicActor(req.actor), message: 'Administrator account is already active' })
    }
    if (req.actor.staff) {
      return res.json({ success: true, data: publicActor(req.actor), message: 'Staff account is already linked' })
    }

    const emails = verifiedEmails(req.actor.clerkUser)
    if (!emails.length) {
      return res.status(400).json({ success: false, message: 'Verify your Clerk email address before activating staff access' })
    }

    const staff = await Staff.findOne({ email: { $in: emails } })
    if (!staff) {
      return res.status(404).json({ success: false, message: 'No MediCare staff record matches your verified email address' })
    }
    if (staff.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'This staff account is inactive' })
    }
    if (staff.authUserId && staff.authUserId !== req.actor.authUserId) {
      return res.status(409).json({ success: false, message: 'This staff record is already linked to another account' })
    }

    staff.authUserId = req.actor.authUserId
    staff.updatedBy = req.actor.authUserId
    await staff.save()
    clearClerkUserCache(req.actor.authUserId)

    return res.json({
      success: true,
      data: {
        ...publicActor(req.actor),
        role: staff.role,
        staffId: String(staff._id),
        staff: sanitizeStaff(staff),
      },
      message: 'Staff access activated',
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'This Clerk account is already linked to another staff record' })
    }
    console.error('claimStaffAccount error:', error)
    return res.status(500).json({ success: false, message: 'Unable to activate staff access' })
  }
}
