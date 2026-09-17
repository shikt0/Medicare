import mongoose from 'mongoose'

export function cleanString(value, maxLength = Infinity) {
  return String(value ?? '').trim().slice(0, maxLength)
}

export function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isDateKey(value) {
  const text = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

export function isTime24(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))
}

export function timeMinutes(value) {
  if (!isTime24(value)) return -1
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

export function isObjectId(value) {
  return mongoose.isValidObjectId(value)
}

export function pagination(query, defaultLimit = 50) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit))
  return { page, limit, skip: (page - 1) * limit }
}

export function actorKey(actor) {
  return `${actor?.role || 'unknown'}:${actor?.id || ''}`
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
