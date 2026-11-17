const configuredCurrency = String(import.meta.env?.VITE_CURRENCY || 'BDT').toUpperCase()
export const DEFAULT_CURRENCY = ['BDT', 'INR'].includes(configuredCurrency) ? configuredCurrency : 'BDT'

export function formatCurrency(value, currency = DEFAULT_CURRENCY) {
  const amount = Number(value || 0)
  const currencyCode = String(currency).toUpperCase()
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: ['BDT', 'INR'].includes(currencyCode) ? currencyCode : DEFAULT_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function revenueAmount(breakdown, currency = DEFAULT_CURRENCY) {
  const key = String(currency).toLowerCase()
  const amount = Number(breakdown?.[key] ?? breakdown?.[key.toUpperCase()] ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

export function bookingCurrency(booking) {
  return booking?.payment?.currency || (booking?.payment?.method === 'Online' ? 'INR' : 'BDT')
}

export function formatRevenue(value, breakdown) {
  const amounts = Object.entries(breakdown || {}).filter(([, amount]) => Number.isFinite(Number(amount)) && Number(amount) !== 0)
  if (amounts.length) return amounts.map(([currency, amount]) => formatCurrency(amount, currency)).join(' · ')
  if (!Number(value)) return formatCurrency(0)
  return `${new Intl.NumberFormat('en-BD').format(Number(value))} (currency unavailable)`
}

export function mergeRevenueBreakdowns(breakdowns) {
  if (breakdowns.some((value) => !value)) return undefined
  return breakdowns.reduce((total, breakdown) => {
    Object.entries(breakdown).forEach(([currency, amount]) => { total[currency] = (total[currency] || 0) + Number(amount || 0) })
    return total
  }, {})
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
