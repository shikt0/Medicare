import Announcement from '../models/Announcement.js'
import Applicant from '../models/Applicant.js'
import Appointment from '../models/Appointment.js'
import Doctor from '../models/Doctor.js'
import FreelancerAssignment from '../models/FreelancerAssignment.js'
import JobOpening from '../models/JobOpening.js'
import LabTestOrder from '../models/LabTestOrder.js'
import Shift from '../models/Shift.js'
import Staff, { STAFF_ROLES } from '../models/Staff.js'
import { relevantFilter } from './announcementController.js'
import { localDateKey } from '../utils/validation.js'

async function unreadAnnouncements(actor) {
  return Announcement.countDocuments({ ...relevantFilter(actor), readBy: { $ne: actor.staffId } })
}

export async function getRoleDashboard(req, res) {
  try {
    const today = localDateKey()
    const role = req.actor.role
    let data = { role, generatedAt: new Date() }
    if (role === 'admin') {
      const [doctors, staff, appointments, pendingLabs, patientIds, groups] = await Promise.all([
        Doctor.countDocuments(), Staff.countDocuments(), Appointment.countDocuments(),
        LabTestOrder.countDocuments({ status: { $nin: ['completed', 'cancelled'] } }),
        Appointment.distinct('createdBy', { createdBy: { $nin: [null, ''] } }),
        Staff.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      ])
      const staffByRole = Object.fromEntries(STAFF_ROLES.map((item) => [item, 0]))
      groups.forEach((item) => { if (item._id in staffByRole) staffByRole[item._id] = item.count })
      data = { ...data, doctors, staff, patients: patientIds.length, appointments, pendingLabs, staffByRole }
    } else if (role === 'nurse') {
      const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
      const [todayShifts, upcomingShifts, weekShifts, unread] = await Promise.all([
        Shift.countDocuments({ staffId: req.actor.staffId, date: today, status: 'scheduled' }),
        Shift.countDocuments({ staffId: req.actor.staffId, date: { $gt: today }, status: 'scheduled' }),
        Shift.find({ staffId: req.actor.staffId, date: { $gte: today, $lte: localDateKey(weekEnd) }, status: 'scheduled' }).select('startTime endTime').lean(),
        unreadAnnouncements(req.actor),
      ])
      const weekHours = weekShifts.reduce((sum, item) => {
        const [sh, sm] = item.startTime.split(':').map(Number); const [eh, em] = item.endTime.split(':').map(Number)
        return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
      }, 0)
      data = { ...data, todayShifts, upcomingShifts, weekHours, unreadAnnouncements: unread }
    } else if (role === 'pathologist') {
      const [assigned, urgent, processing, completed] = await Promise.all([
        LabTestOrder.countDocuments({ assignedPathologist: req.actor.staffId, status: { $nin: ['completed', 'cancelled'] } }),
        LabTestOrder.countDocuments({ assignedPathologist: req.actor.staffId, priority: 'urgent', status: { $nin: ['completed', 'cancelled'] } }),
        LabTestOrder.countDocuments({ assignedPathologist: req.actor.staffId, status: 'processing' }),
        LabTestOrder.countDocuments({ assignedPathologist: req.actor.staffId, status: 'completed' }),
      ])
      data = { ...data, assigned, urgent, processing, completed }
    } else if (role === 'hr') {
      const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30)
      const [staff, openJobs, applicants, recentHires] = await Promise.all([
        Staff.countDocuments(), JobOpening.countDocuments({ status: 'open', deadline: { $gte: new Date() } }),
        Applicant.countDocuments({ status: { $nin: ['rejected', 'hired'] } }), Staff.countDocuments({ joiningDate: { $gte: monthAgo } }),
      ])
      data = { ...data, staff, openJobs, applicants, recentHires }
    } else if (role === 'freelancer') {
      const [active, upcoming, completed, unread] = await Promise.all([
        FreelancerAssignment.countDocuments({ freelancerId: req.actor.staffId, status: { $in: ['accepted', 'in-progress'] } }),
        FreelancerAssignment.countDocuments({ freelancerId: req.actor.staffId, date: { $gte: today }, status: { $in: ['assigned', 'accepted'] } }),
        FreelancerAssignment.countDocuments({ freelancerId: req.actor.staffId, status: 'completed' }),
        unreadAnnouncements(req.actor),
      ])
      data = { ...data, active, upcoming, completed, unreadAnnouncements: unread }
    }
    return res.json({ success: true, data })
  } catch (error) {
    console.error('getRoleDashboard error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load dashboard statistics' })
  }
}
