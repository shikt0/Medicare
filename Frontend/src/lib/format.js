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

export function cleanSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return []
  const today = localDateKey(new Date())
  return Object.entries(schedule)
    .filter(([date, slots]) => date >= today && Array.isArray(slots) && slots.length)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, slots]) => ({ date, slots: [...new Set(slots)] }))
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
