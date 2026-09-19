export function getId(value) {
  return value?._id || value?.id || ''
}

export function formatCurrency(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatDate(value, options = {}) {
  if (!value) return 'Date unavailable'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-BD', {
    weekday: options.short ? undefined : 'short',
    month: 'short',
    day: 'numeric',
    year: options.short ? undefined : 'numeric',
  })
}

export function formatAppointmentTime(item) {
  if (item?.time) return item.time
  if (item?.hour === undefined || item?.minute === undefined || !item?.ampm) return 'Time unavailable'
  return `${String(item.hour).padStart(2, '0')}:${String(item.minute).padStart(2, '0')} ${item.ampm}`
}

export function isAvailable(value) {
  return value?.availability === undefined
    ? value?.available !== false
    : String(value.availability).toLowerCase() === 'available'
}

export const WEEK_DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function normalizeWeeklySchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return {}
  const output = {}
  Object.entries(schedule).forEach(([rawDay, slots]) => {
    if (!Array.isArray(slots)) return
    const lowered = String(rawDay).toLowerCase()
    let day = WEEK_DAYS.find((item) => item.key === lowered || item.key.slice(0, 3) === lowered)?.key
    if (!day && /^\d{4}-\d{2}-\d{2}$/.test(lowered)) {
      const legacyDate = new Date(`${lowered}T00:00:00`)
      if (!Number.isNaN(legacyDate.getTime())) day = WEEKDAY_KEYS[legacyDate.getDay()]
    }
    if (!day) return
    const normalizedSlots = slots.map(normalizeTimeSlot).filter(Boolean)
    output[day] = [...new Set([...(output[day] || []), ...normalizedSlots])].sort(compareTimeSlots)
  })
  return output
}

export function cleanSchedule(schedule, options = {}) {
  const weekly = normalizeWeeklySchedule(schedule)
  const bookedSlots = options.bookedSlots || {}
  const horizonDays = Math.max(7, Number(options.horizonDays || 28))
  const start = new Date()
  const nowMinutes = start.getHours() * 60 + start.getMinutes()
  start.setHours(0, 0, 0, 0)
  const output = []

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    const dateKey = localDateKey(date)
    const slots = weekly[WEEKDAY_KEYS[date.getDay()]] || []
    const booked = new Set((bookedSlots[dateKey] || []).map(normalizeTimeSlot))
    const availableSlots = slots.filter((slot) => !booked.has(normalizeTimeSlot(slot)) && (offset > 0 || timeSlotMinutes(slot) > nowMinutes))
    if (availableSlots.length) output.push({ date: dateKey, slots: availableSlots })
  }

  return output
}

export function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function statusClass(status) {
  return `patient-status patient-status--${String(status || 'pending').toLowerCase()}`
}

export function appointmentImage(item, kind) {
  if (kind === 'service') return item?.serviceImage?.url || item?.serviceId?.imageUrl || ''
  return item?.doctorImage?.url || item?.doctorId?.imageUrl || ''
}

function normalizeTimeSlot(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${match[3].toUpperCase()}`
}

function compareTimeSlots(first, second) {
  return timeSlotMinutes(first) - timeSlotMinutes(second)
}

function timeSlotMinutes(value) {
  const normalized = normalizeTimeSlot(value)
  if (!normalized) return Number.POSITIVE_INFINITY
  const [time, suffix] = normalized.split(' ')
  const [rawHour, minute] = time.split(':').map(Number)
  return (rawHour % 12 + (suffix === 'PM' ? 12 : 0)) * 60 + minute
}
