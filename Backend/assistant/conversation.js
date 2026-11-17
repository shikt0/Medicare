import { normalizeTimeSlot, timeSlotMinutes } from '../utils/weeklySchedule.js'

const idPattern = /^[a-f\d]{24}$/i
const topics = ['booking', 'schedule', 'appointments', 'services', 'record', 'general']
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
export const money = (amount, currency = 'BDT') => `${currency} ${Number(amount || 0).toLocaleString('en-BD')}`
export const joinNames = (items) => new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(items)

// Normalize only common navigation words, never infer a role or change clinical
// meaning. The original message remains in the UI/history.
const navigationSpellings = new Map(Object.entries({
  nxt: 'next', nexxt: 'next', nextt: 'next',
  avaiable: 'available', avaliable: 'available', availble: 'available',
  avilable: 'available', avaialble: 'available', availabe: 'available',
  avialable: 'available', avilabl: 'available', avail: 'available',
  availibility: 'availability', availablity: 'availability',
  tmrw: 'tomorrow', tmr: 'tomorrow', tommorow: 'tomorrow', tomorow: 'tomorrow',
  appt: 'appointment', appoinment: 'appointment', appointmnt: 'appointment',
  schedual: 'schedule', shedule: 'schedule', shedules: 'schedules',
  dermatalogist: 'dermatologist', dermatoligist: 'dermatologist',
}))
export function normalizeClinicMessage(text) {
  return text.normalize('NFKC').replace(/[’‘]/g, "'")
    .replace(/\b[a-z]+\b/gi, (word) => navigationSpellings.get(word.toLowerCase()) || word)
}

export function nextAvailabilityRequested(text) {
  return /\b(?:next|first)\s+(?:available|free|open)(?:\s+(?:time|slot|appointment|opening))?\b|\b(?:earliest|soonest)\b|\bas soon as possible\b/i.test(normalizeClinicMessage(text))
}

// This is care navigation, not diagnosis or treatment. Emergency and medication
// checks run first in chat.js. Source: AAD's definition of dermatology.
export function careNavigation(text) {
  text = normalizeClinicMessage(text)
  const topic = /\b(?:skin|rash|rashes|acne|eczema|pimples?|hair (?:loss|fall)|hairfall|scalp|nail (?:problem|issue|infection)s?)\b/i
  if (!topic.test(text)) return null
  const directory = /\b(?:doctor|specialist|dermatologist|appointment|book|find|who (?:can|should)|someone to (?:look at|check))\b/i.test(text)
  if (/\b(?:diagnos\w*|treat\w*|cure|dose|dosage|medicine|medication|prescri\w*|cream|ointment|serious|dangerous|causes?|caused|why)\b/i.test(text)) return null
  if (/\b(?:no|without|don't have|do not have|not having)\s+(?:any |a |an )?(?:skin|rash|acne|eczema|pimples?|hair|scalp|nail)\b/i.test(text)) return null
  if (!directory && /^(?:what (?:is|are)|explain|tell me about|how|is|are|can|should)\b/i.test(text)) return null
  const concern = /\b(?:i have|i've got|i am having|i'm having|my|problem|problems|issue|issues|concern|concerns|itchy|itching|rash|rashes|acne|eczema|pimples?|hair (?:loss|fall)|hairfall)\b/i.test(text)
  if (!directory && !concern) return null
  return { specialization: 'dermat', introduction: 'A dermatologist can help with skin, hair, or nail concerns. ',
    source: { title: 'What dermatologists do — American Academy of Dermatology', url: 'https://www.aad.org/public/fad/what-is-a-derm' } }
}
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}

// Conversation parameters are hints, never account authority or cached clinic facts.
// Every doctor, appointment, price and available slot is read again through scoped tools.
export function readConversation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const state = {}
  if (topics.includes(value.topic)) state.topic = value.topic
  for (const key of ['doctorId', 'appointmentId']) if (idPattern.test(value[key] || '')) state[key] = value[key]
  for (const key of ['date', 'from', 'to']) if (validDate(value[key])) state[key] = value[key]
  if (typeof value.time === 'string' && value.time.length <= 12 && normalizeTimeSlot(value.time)) state.time = normalizeTimeSlot(value.time)
  if (typeof value.specialization === 'string') state.specialization = value.specialization.slice(0, 80)
  if (typeof value.doctorName === 'string') state.doctorName = value.doctorName.slice(0, 120)
  if (Array.isArray(value.doctorOptions)) state.doctorOptions = value.doctorOptions.filter((id) => typeof id === 'string' && idPattern.test(id)).slice(0, 5)
  if (Array.isArray(value.appointmentOptions)) state.appointmentOptions = value.appointmentOptions.filter((id) => typeof id === 'string' && idPattern.test(id)).slice(0, 50)
  if (Array.isArray(value.slotOptions)) state.slotOptions = value.slotOptions.filter((slot) => typeof slot === 'string' && slot.length <= 12 && normalizeTimeSlot(slot)).slice(0, 8).map(normalizeTimeSlot)
  if (['upcoming', 'all'].includes(value.view)) state.view = value.view
  if (['Pending', 'Confirmed', 'Completed', 'Canceled', 'Rescheduled'].includes(value.status)) state.status = value.status
  return state
}

export function dateInQuestion(text, today) {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
  if (iso) return iso // The tool rejects impossible calendar dates instead of silently changing them.
  if (/day after tomorrow|পরশু/i.test(text)) return addDays(today, 2)
  if (/tomorrow|আগামীকাল/i.test(text)) return addDays(today, 1)
  if (/yesterday|গতকাল/i.test(text)) return addDays(today, -1)
  if (/today|আজ/i.test(text)) return today
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const day = weekdays.findIndex((name) => new RegExp(`\\b${name}(?:s)?\\b`, 'i').test(text))
  if (day !== -1) {
    const current = new Date(`${today}T00:00:00Z`).getUTCDay()
    if (/next week|last week|this week/i.test(text)) {
      const monday = addDays(today, -((current + 6) % 7))
      return addDays(monday, (day + 6) % 7 + (/next week/i.test(text) ? 7 : /last week/i.test(text) ? -7 : 0))
    }
    let delta = (day - current + 7) % 7
    if (/\bnext\b/i.test(text) && delta === 0) delta = 7
    return addDays(today, delta)
  }
  const month = text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i)
    || text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/i)?.map((v, i, a) => i === 1 ? a[2] : i === 2 ? a[1] : v)
  if (month) {
    const number = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(month[1].slice(0, 3).toLowerCase()) + 1
    const date = `${month[3] || today.slice(0, 4)}-${String(number).padStart(2, '0')}-${month[2].padStart(2, '0')}`
    return date // Recognized impossible dates must be rejected, never reuse the previous date.
  }
  return null
}

export function dateWindow(text, today, previous = {}, { patient = false } = {}) {
  const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g)
  if (dates?.length >= 2) return { from: dates[0], to: dates[1] }
  const date = dateInQuestion(text, today)
  if (date) return { from: date, to: date }
  if (/\b(next|this|last) week\b/i.test(text)) {
    const monday = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
    const from = addDays(monday, /next week/i.test(text) ? 7 : /last week/i.test(text) ? -7 : 0)
    return { from, to: addDays(from, 6) }
  }
  if (/\b(history|past|previous|last month)\b/i.test(text)) return { from: addDays(today, -30), to: today }
  if (/\b(upcoming|next seven days|next 7 days)\b/i.test(text)) return { from: today, to: addDays(today, 6) }
  if (previous.from && previous.to) return { from: previous.from, to: previous.to }
  return { from: today, to: addDays(today, patient ? 29 : 0) }
}

export function friendlyDate(date, today) {
  if (date === today) return 'today'
  if (today && date === addDays(today, 1)) return 'tomorrow'
  if (!validDate(date)) return date || 'that day'
  return `on ${new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date))}`
}

export function windowLabel(meta = {}, today) {
  if (meta.from === meta.to) return friendlyDate(meta.from, today)
  const format = (date) => validDate(date) ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(date)) : date
  return `from ${format(meta.from)} to ${format(meta.to)}`
}

const specialties = [
  [/cardiolog|heart specialist|হার্ট|হৃদরোগ/i, 'cardio'],
  [/dermatolog|skin specialist|চর্ম/i, 'dermat'],
  [/neurolog|brain specialist|নিউরো/i, 'neurol'],
  [/gynecolog|gynaecolog|women.?s health|গাইনি/i, 'gynec'],
  [/pediatri|paediatri|child specialist|শিশু/i, 'pediatr'],
  [/orthop|bone specialist|অর্থোপেড/i, 'orthop'],
  [/gastroenter|stomach specialist/i, 'gastro'],
  [/endocrinolog|hormone specialist/i, 'endocrin'],
  [/nephrolog|kidney specialist/i, 'nephrol'],
  [/urolog/i, 'urol'],
  [/pulmonolog|lung specialist/i, 'pulmon'],
  [/oncolog|cancer specialist/i, 'oncol'],
  [/psychiatr|mental health/i, 'psychiatr'],
  [/dentist|dental|দাঁত/i, 'dent'],
  [/ophthalm|eye specialist/i, 'ophthalm'],
  [/\bent\b|ear.*nose.*throat/i, 'ent'],
  [/internal medicine|general physician|general medicine|general practitioner/i, 'general'],
]
export const specialtyInQuestion = (text) => specialties.find(([pattern]) => pattern.test(text))?.[1]
export function matchesSpecialty(doctor, specialty) {
  const value = (doctor.specialization || '').toLowerCase()
  if (specialty === 'gynec') return /gyn[ae]*c/.test(value)
  if (specialty === 'pediatr') return /p[ae]*diatr/.test(value)
  if (specialty === 'general') return /general|internal medicine/.test(value)
  return value.includes(specialty.toLowerCase())
}

export function ordinalInQuestion(text) {
  const match = text.match(/\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/i)?.[1]?.toLowerCase()
  if (match) return ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(match) >= 0 ? ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(match) : Number(match[0]) - 1
  const number = text.match(/^(?:number |option |doctor )?([1-5])(?: please)?[.!?\s]*$/i)?.[1]
  return number ? Number(number) - 1 : -1
}

export function matchingDoctors(doctors, text) {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')
  const fullMatches = doctors.filter((doctor) => {
    const name = doctor.name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim()
    return name && normalized.includes(name)
  })
  if (fullMatches.length) return fullMatches
  return doctors.filter((doctor) => {
    const name = doctor.name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim()
    return name.split(/\s+/).some((part) => part.length >= 4 && !['doctor', 'test', 'general'].includes(part) && normalized.split(/\s+/).includes(part))
  })
}

export function timeInQuestion(text, slots = []) {
  const explicit = text.match(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\b/i)?.[0]?.replace(/\./g, '')
  if (explicit) return normalizeTimeSlot(explicit.replace(/^(\d{1,2})\s*([ap]m)$/i, '$1:00 $2'))
  const military = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (military && (Number(military[1]) > 12 || Number(military[1]) === 0)) return normalizeTimeSlot(`${Number(military[1]) % 12 || 12}:${military[2]} ${Number(military[1]) >= 12 ? 'PM' : 'AM'}`)
  const hour = text.match(/^(?:at |around |book |make it |how about |what about )?(\d{1,2})(?::([0-5]\d))?(?: (?:please|works|is fine|in the (?:morning|afternoon|evening)))?[.!?\s]*$/i)
  if (!hour || Number(hour[1]) > 12 || Number(hour[1]) < 1) return null
  const matches = slots.filter((time) => Number(time.split(':')[0]) === Number(hour[1]) && (!hour[2] || time.split(':')[1].slice(0, 2) === hour[2])
    && (!/morning/i.test(text) || time.endsWith('AM')) && (!/afternoon|evening/i.test(text) || time.endsWith('PM')))
  return matches.length === 1 ? matches[0] : null
}

export function suggestedSlots(slots, text) {
  if (/morning/i.test(text)) return slots.filter((time) => timeSlotMinutes(time) < 720)
  if (/afternoon/i.test(text)) return slots.filter((time) => timeSlotMinutes(time) >= 720 && timeSlotMinutes(time) < 1020)
  if (/evening/i.test(text)) return slots.filter((time) => timeSlotMinutes(time) >= 1020)
  return slots
}

export function inferIntent(text, state = {}, role = 'guest') {
  text = normalizeClinicMessage(text)
  if (/\b(cancel|reschedule|move|change) (?:my |the )?(?:appointment|booking|visit)\b/i.test(text)) return 'manage'
  if (/^(start over|new chat|never mind|nevermind|forget it|cancel this|stop)[.!?\s]*$/i.test(text)) return 'reset'
  if (/^(cancel it|cancel that)[.!?\s]*$/i.test(text)) return state.topic === 'booking' ? 'reset' : 'manage'
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|হ্যালো)[.!?\s]*$/i.test(text)) return 'greeting'
  if (/^(thanks|thank you|thank you so much|cheers|ধন্যবাদ)[.!?\s]*$/i.test(text)) return 'thanks'
  if (/\b(can you help|help me|what can you do|how can you help|who are you)\b/i.test(text) && !/book|doctor|patient|schedule|appointment/i.test(text)) return 'help'
  if (/\b(service|services|test prices|lab tests?|blood test|x-ray|mri|ultrasound)\b/i.test(text) && !/prepar|result|what is|explain|mean/i.test(text)) return 'services'
  if (role !== 'doctor' && careNavigation(text)) return 'booking'
  if (nextAvailabilityRequested(text) && (role !== 'doctor' || state.topic === 'booking')) return 'booking'
  if (role === 'doctor') {
    if (/\b(notes?|details?|record|lab results?|tell me about|more about)\b/i.test(text) && (state.topic === 'schedule' || state.topic === 'record' || /appointment\s+[a-f\d]{24}/i.test(text))) return 'record'
    if (/\b(schedule|appointments?|patients?|my day|my week|busy|who.*next|who.*seeing|who.*coming|availability|working hours)\b/i.test(text)) return 'schedule'
    if (['schedule', 'record'].includes(state.topic) && /tomorrow|today|yesterday|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|first|second|third|more|all|rest|\d{4}-\d{2}-\d{2}/i.test(text)) return /\b(tell me|details|notes)\b/i.test(text) ? 'record' : 'schedule'
  }
  if (/\bmy (appointments?|bookings?|visits?|schedule)\b|আমার.*(বুকিং|অ্যাপ)/i.test(text)) return 'appointments'
  if (state.topic === 'appointments' && /tomorrow|today|next|week|more|all|rest|\d{4}-\d{2}-\d{2}/i.test(text)) return 'appointments'
  if (/\b(book|booking|appointment|doctor|doctors|dr|specialist|consultation|slot|available|availability)\b|বুক|ডাক্তার/i.test(text) || specialtyInQuestion(text)) return 'booking'
  if (state.topic === 'booking' && (/^(yes|yeah|yep|sure|okay|ok|please|that one|same time)[.!?\s]*$/i.test(text) || /tomorrow|today|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|earliest|first|second|third|fourth|fifth|instead|cheaper|cost|fee|price|charge|more|other|\d/i.test(text))) return 'booking'
  if (state.topic === 'services' && /cost|price|fee|how much|more/i.test(text)) return 'services'
  return null
}
