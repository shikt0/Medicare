export const WEEK_DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

const DAY_BY_INDEX = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_ALIASES = new Map(WEEK_DAYS.flatMap(({ key }) => [
  [key, key],
  [key.slice(0, 3), key],
]))

export function normalizeTimeSlot(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return ''
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return ''
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${match[3].toUpperCase()}`
}

export function timeSlotMinutes(value) {
  const normalized = normalizeTimeSlot(value)
  if (!normalized) return Number.POSITIVE_INFINITY
  const [time, suffix] = normalized.split(' ')
  const [rawHour, minute] = time.split(':').map(Number)
  return (rawHour % 12 + (suffix === 'PM' ? 12 : 0)) * 60 + minute
}

export function weekdayKeyForDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return DAY_BY_INDEX[date.getUTCDay()]
}

function weekdayKey(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return DAY_ALIASES.get(normalized) || weekdayKeyForDate(normalized)
}

function plainSchedule(value) {
  if (!value) return {}
  if (typeof value === 'string') {
    try { return plainSchedule(JSON.parse(value)) } catch { return {} }
  }
  if (typeof value.forEach === 'function' && !Array.isArray(value)) {
    const output = {}
    value.forEach((slots, key) => { output[key] = slots })
    return output
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function normalizeWeeklySchedule(value) {
  const output = {}
  Object.entries(plainSchedule(value)).forEach(([rawDay, slots]) => {
    const day = weekdayKey(rawDay)
    if (!day || !Array.isArray(slots)) return
    const normalizedSlots = slots.map(normalizeTimeSlot).filter(Boolean)
    output[day] = [...new Set([...(output[day] || []), ...normalizedSlots])]
      .sort((first, second) => timeSlotMinutes(first) - timeSlotMinutes(second))
  })
  return output
}

export function isWeeklySlotAvailable(schedule, date, time) {
  const day = weekdayKeyForDate(date)
  const slot = normalizeTimeSlot(time)
  if (!day || !slot) return false
  return (normalizeWeeklySchedule(schedule)[day] || []).includes(slot)
}
