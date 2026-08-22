export function formatCurrency(value) {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getId(item) {
  return item?._id || item?.id || ''
}

export function serviceAppointmentTime(item) {
  if (!item) return '-'
  if (item.time) return item.time
  if (item.hour === undefined || item.minute === undefined || !item.ampm) return '-'
  return `${String(item.hour).padStart(2, '0')}:${String(item.minute).padStart(2, '0')} ${item.ampm}`
}

export function doctorNameFromAppointment(item) {
  return item?.doctorName || item?.doctorId?.name || 'Doctor'
}

export function serviceNameFromAppointment(item) {
  return item?.serviceName || item?.serviceId?.name || 'Service'
}
