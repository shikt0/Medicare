import Appointment from '../models/Appointment.js'
import { evaluateCashPaymentOnCompletion } from '../utils/cashCompletion.js'
import { isWeeklySlotAvailable, normalizeTimeSlot, normalizeWeeklySchedule, timeSlotMinutes, weekdayKeyForDate } from '../utils/weeklySchedule.js'
import { localDateKey } from '../utils/validation.js'
import { handleAppointmentSlotError, requireAppointmentSlotIndex } from '../utils/appointmentSlots.js'

const APPOINTMENT_STATUSES = ['Pending', 'Confirmed', 'Completed', 'Canceled', 'Rescheduled']

function doctorId(req) {
  return String(req.doctor?._id || req.doctor?.id || '')
}

function serializeDoctor(doctor) {
  const value = doctor?.toObject ? doctor.toObject({ flattenMaps: true }) : { ...doctor }
  delete value.password
  value.schedule = normalizeWeeklySchedule(value.schedule)
  return value
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function getDoctorPortalMe(req, res) {
  return res.json({ success: true, data: serializeDoctor(req.doctor) })
}

export async function getDoctorPortalAppointments(req, res) {
  try {
    const { status, search = '', page: pageRaw = 1, limit: limitRaw = 100 } = req.query
    const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1)
    const limit = Math.min(200, Math.max(1, Number.parseInt(limitRaw, 10) || 100))
    const filter = { doctorId: doctorId(req) }

    if (status && status !== 'All') {
      if (!APPOINTMENT_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid appointment status' })
      }
      filter.status = status
    }

    const keyword = String(search).trim()
    if (keyword) {
      const expression = new RegExp(escapeRegExp(keyword), 'i')
      filter.$or = [{ patientName: expression }, { mobile: expression }]
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ date: 1, time: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(filter),
    ])

    return res.json({
      success: true,
      appointments,
      meta: { page, limit, total, count: appointments.length },
    })
  } catch (error) {
    console.error('getDoctorPortalAppointments error:', error)
    return res.status(500).json({ success: false, message: 'Unable to load appointments' })
  }
}

export async function updateDoctorPortalAppointment(req, res) {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctorId(req) })
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' })

    const { status, date, time, doctorNotes, cashPaymentReceived } = req.body || {}
    const terminal = ['Completed', 'Canceled'].includes(appointment.status)

    if (status !== undefined) {
      if (!APPOINTMENT_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid appointment status' })
      }
      if (terminal && status !== appointment.status) {
        return res.status(400).json({ success: false, message: 'Completed or canceled appointments cannot be reopened' })
      }
      if (status === 'Completed' && appointment.status !== 'Completed') {
        const cashDecision = evaluateCashPaymentOnCompletion(appointment, cashPaymentReceived)
        if (!cashDecision.ok) return res.status(400).json({ success: false, message: cashDecision.message })
        if (cashDecision.requiresDecision) {
          appointment.payment.status = cashDecision.paymentStatus
          appointment.payment.amount = cashDecision.amount
          appointment.paidAt = cashDecision.paidAt
          appointment.payment.meta = {
            ...(appointment.payment.meta || {}),
            cashReceived: cashDecision.cashPaymentReceived,
            cashConfirmedAt: cashDecision.confirmedAt,
            cashConfirmedBy: doctorId(req),
          }
          appointment.markModified('payment.meta')
        }
      }
      appointment.status = status
    }

    if (date !== undefined || time !== undefined) {
      if (terminal) return res.status(400).json({ success: false, message: 'Completed or canceled appointments cannot be rescheduled' })
      if (!weekdayKeyForDate(date)) {
        return res.status(400).json({ success: false, message: 'Choose a valid appointment date' })
      }
      const normalizedTime = normalizeTimeSlot(time)
      if (!normalizedTime) {
        return res.status(400).json({ success: false, message: 'Choose a valid appointment time' })
      }
      const now = new Date()
      const today = localDateKey(now)
      if (String(date) < today || (String(date) === today && timeSlotMinutes(normalizedTime) <= now.getHours() * 60 + now.getMinutes())) {
        return res.status(400).json({ success: false, message: 'The appointment time must be in the future' })
      }
      if (req.doctor.availability !== 'Available' || !isWeeklySlotAvailable(req.doctor.schedule, date, normalizedTime)) {
        return res.status(409).json({ success: false, message: 'This time is not available in your weekly schedule' })
      }
      await requireAppointmentSlotIndex(Appointment.collection)
      const conflict = await Appointment.findOne({ _id: { $ne: appointment._id }, doctorId: doctorId(req), date: String(date), time: normalizedTime, status: { $ne: 'Canceled' } }).lean()
      if (conflict) {
        return res.status(409).json({ success: false, message: 'This appointment time has already been booked' })
      }
      appointment.date = String(date)
      appointment.time = normalizedTime
      appointment.rescheduledTo = { date: appointment.date, time: appointment.time }
      appointment.status = 'Rescheduled'
    }

    if (doctorNotes !== undefined) {
      const value = String(doctorNotes).trim()
      if (value.length > 1000) return res.status(400).json({ success: false, message: 'Clinical notes cannot exceed 1000 characters' })
      appointment.doctorNotes = value
    }

    await appointment.save()
    return res.json({ success: true, appointment: appointment.toObject() })
  } catch (error) {
    if (handleAppointmentSlotError(error, res)) return
    if (error?.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid appointment identifier' })
    console.error('updateDoctorPortalAppointment error:', error)
    return res.status(500).json({ success: false, message: 'Unable to update appointment' })
  }
}
