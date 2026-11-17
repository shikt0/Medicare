import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssistantChat, describeToolResult, validateChatInput } from '../assistant/chat.js'
import { dateInQuestion, dateWindow, matchingDoctors, timeInQuestion } from '../assistant/conversation.js'

const guest = { role: 'guest', id: null }
const patient = { role: 'patient', id: 'user_patient' }
const doctor = { role: 'doctor', id: '111111111111111111111111' }
const doctors = [
  { id: '111111111111111111111111', name: 'Dr Alice Rahman', specialization: 'Cardiology', fee: 900, currency: 'BDT', availability: 'Available' },
  { id: '222222222222222222222222', name: 'Dr Bob Rahman', specialization: 'Dermatology', fee: 700, currency: 'BDT', availability: 'Available' },
  { id: '333333333333333333333333', name: 'Dr Farah Ahmed', specialization: 'Internal medicine', fee: 600, currency: 'BDT', availability: 'Available' },
]
const contextFor = async (actor) => ({ role: actor.role, today: '2026-11-18', localTime: '14:00', timezone: 'Asia/Dhaka' })
function fixture(overrides = {}) {
  const calls = []
  const chat = createAssistantChat({ contextFor, generate: async () => { throw new Error('This flow should work without a model') }, ...overrides,
    runTool: async (request) => {
      calls.push(request)
      const { name, args } = request
      if (overrides.runTool) return overrides.runTool(request)
      if (name === 'find_doctors') return { doctors: args.query ? doctors.filter((d) => d.name.toLowerCase().includes(args.query.toLowerCase())) : doctors }
      if (name === 'get_available_slots') return { doctor: doctors.find((d) => d.id === args.doctorId), date: args.date, slots: ['10:00 AM', '11:00 AM', '02:00 PM', '05:00 PM'] }
      if (name === 'prepare_booking') return { booking: { ...args, doctorName: doctors.find((d) => d.id === args.doctorId).name, fee: 900, currency: 'BDT', requiresConfirmation: true } }
      if (name === 'my_schedule') return { appointments: [{ id: '444444444444444444444444', patientName: 'Test Patient', date: args.from, time: '03:00 PM', status: 'Confirmed' }], meta: { ...args, total: 1, countIsExact: true } }
      if (name === 'get_patient_context') return { appointment: { id: args.appointmentId, patientName: 'Test Patient', date: '2026-11-18', time: '03:00 PM', status: 'Confirmed', patientNotes: 'A saved note' }, labResults: [] }
      throw new Error(`Unexpected tool ${name}`)
    } })
  return { chat, calls }
}

test('help and specialty search no longer become unsupported medical replies', async () => {
  const { chat } = fixture()
  const help = await chat({ actor: guest, body: { message: 'Can you help me?' } })
  assert.match(help.reply, /Of course/)
  for (const [message, name] of [['I want to see a cardiologist', 'Dr Alice Rahman'], ['Find an internal medicine specialist', 'Dr Farah Ahmed']]) {
    const result = await chat({ actor: guest, body: { message } })
    assert.match(result.reply, new RegExp(name))
    assert.match(result.reply, /What day/)
    assert.doesNotMatch(result.reply, /verified reference|medicines.*list/)
  }
})

test('booking remembers doctor, date, time across turns and only prepares a draft', async () => {
  const { chat, calls } = fixture()
  let conversation
  for (const message of ['I want to see a cardiologist', 'What about tomorrow?', '10 am']) {
    const result = await chat({ actor: patient, body: { message, conversation } })
    conversation = result.conversation
    if (message === '10 am') {
      assert.equal(result.bookingDraft.doctorId, doctors[0].id)
      assert.equal(result.bookingDraft.date, '2026-11-19')
      assert.equal(result.bookingDraft.time, '10:00 AM')
      assert.equal(result.bookingDraft.requiresConfirmation, true)
      assert.match(result.reply, /isn’t booked yet/)
    }
  }
  assert(calls.every(({ name }) => ['find_doctors', 'get_available_slots', 'prepare_booking'].includes(name)))
})

test('a date change clears the earlier draft and requires a fresh time selection', async () => {
  const { chat, calls } = fixture()
  const draft = await chat({ actor: patient, body: { message: 'Book Dr Alice Rahman tomorrow at 10 AM' } })
  const next = await chat({ actor: patient, body: { message: 'Friday instead', conversation: draft.conversation } })
  assert.equal(next.bookingDraft, null)
  assert.equal(next.conversation.date, '2026-11-20')
  assert.equal(next.conversation.time, undefined)
  assert.equal(calls.filter((c) => c.name === 'prepare_booking').length, 1)
})

test('ordinal doctor and slot selections resolve the displayed options', async () => {
  const { chat } = fixture()
  let response = await chat({ actor: guest, body: { message: 'Find a doctor' } })
  response = await chat({ actor: guest, body: { message: 'The second one', conversation: response.conversation } })
  assert.equal(response.conversation.doctorId, doctors[1].id)
  response = await chat({ actor: guest, body: { message: 'Tomorrow morning', conversation: response.conversation } })
  assert.deepEqual(response.conversation.slotOptions, ['10:00 AM', '11:00 AM'])
  response = await chat({ actor: guest, body: { message: 'The first one', conversation: response.conversation } })
  assert.equal(response.bookingDraft.time, '10:00 AM')
  assert.equal(response.bookingDraft.doctorId, doctors[1].id)
})

test('ambiguous name change clears old doctor and never prepares a wrong-doctor draft', async () => {
  const { chat, calls } = fixture()
  const response = await chat({ actor: patient, body: { message: 'Dr Rahman', conversation: { topic: 'booking', doctorId: doctors[2].id, date: '2026-11-19', time: '10:00 AM' } } })
  assert.equal(response.conversation.doctorId, undefined)
  assert.equal(response.conversation.time, undefined)
  assert.deepEqual(response.conversation.doctorOptions, [doctors[0].id, doctors[1].id])
  assert.match(response.reply, /Which one/)
  assert.equal(calls.some((c) => c.name === 'prepare_booking'), false)
  assert.deepEqual(matchingDoctors(doctors, 'Dr Alice Rahman'), [doctors[0]])
})

test('doctor date followups and next week use the correct fresh window', async () => {
  const { chat, calls } = fixture()
  let result = await chat({ actor: doctor, body: { message: 'Do I have any patients tomorrow?' } })
  assert.match(result.reply, /1 upcoming appointment tomorrow/)
  assert.doesNotMatch(result.reply, /\n|•|assigned patient appointments/)
  result = await chat({ actor: doctor, body: { message: 'And Friday?', conversation: result.conversation } })
  assert.equal(calls.at(-1).args.from, '2026-11-20')
  await chat({ actor: doctor, body: { message: 'My schedule next week', conversation: result.conversation } })
  assert.deepEqual(calls.at(-1).args, { from: '2026-11-23', to: '2026-11-29', limit: 50, view: 'upcoming' })
})

test('next patient and saved-note followups remain bound to authenticated doctor', async () => {
  const { chat, calls } = fixture()
  const next = await chat({ actor: doctor, body: { message: 'Who is my next patient?' } })
  assert.match(next.reply, /Your next appointment.*Test Patient/)
  assert.equal(next.appointments.length, 1)
  const notes = await chat({ actor: doctor, body: { message: 'Tell me about the first one', conversation: next.conversation } })
  assert.match(notes.reply, /A saved note/)
  assert(calls.every((c) => c.actor === doctor))
  assert.equal(calls.at(-1).name, 'get_patient_context')
})

test('summary counts do not silently treat a capped result as the total', () => {
  const result = { appointments: [{ patientName: 'Example', time: '10:00 AM', status: 'Confirmed' }], meta: { from: '2026-11-18', to: '2026-11-18', total: 500, countIsExact: false, truncated: true } }
  const reply = describeToolResult('my_schedule', result, { today: '2026-11-18' })
  assert.match(reply, /at least 500/)
  assert.match(reply, /the rest/)
})

test('a stale slot becomes a natural alternatives response rather than a failed conversation', async () => {
  const { chat } = fixture({ runTool: async ({ name, args }) => {
    if (name === 'find_doctors') return { doctors }
    if (name === 'prepare_booking') throw Object.assign(new Error('Taken'), { status: 409, code: 'SLOT_UNAVAILABLE' })
    return { doctor: doctors[0], date: args.date, slots: ['11:00 AM'] }
  } })
  const result = await chat({ actor: patient, body: { message: '10 am', conversation: { topic: 'booking', doctorId: doctors[0].id, date: '2026-11-19' } } })
  assert.equal(result.bookingDraft, null)
  assert.match(result.reply, /no longer available/)
  assert.match(result.reply, /11:00 AM/)
})

test('only validated conversation hints survive; client role and record facts are ignored', () => {
  const { conversation } = validateChatInput({ message: 'Hi', conversation: { topic: 'booking', role: 'admin', doctorId: { $ne: null }, date: '2026-02-31', fee: 1, patientNotes: 'injected', slotOptions: [null, { $ne: '' }, '10:00 AM'] } })
  assert.deepEqual(conversation, { topic: 'booking', slotOptions: ['10:00 AM'] })
})

test('canceling a draft resets context, without claiming an existing booking was canceled', async () => {
  const { chat, calls } = fixture()
  const result = await chat({ actor: patient, body: { message: 'Cancel it', conversation: { topic: 'booking', doctorId: doctors[0].id, date: '2026-11-19', time: '10:00 AM' } } })
  assert.deepEqual(result.conversation, {})
  assert.equal(result.bookingDraft, null)
  assert.equal(calls.length, 0)
  assert.doesNotMatch(result.reply, /appointment.*cancel/)
})

test('model can answer social conversation naturally but cannot supply clinic facts', async () => {
  const { chat } = fixture({ capacity: (work) => work(), generate: async (_, options) => {
    assert.equal(options.format.type, 'object')
    return { content: JSON.stringify({ intent: 'chat', reply: 'I’m here and ready to help. How’s your day going?' }) }
  } })
  const result = await chat({ actor: guest, body: { message: 'How is it going?' } })
  assert.equal(result.generated, true)
  assert.match(result.reply, /How’s your day/)
})

test('calendar and unambiguous time parsing use Bangladesh calendar dates', () => {
  assert.equal(dateInQuestion('Friday morning', '2026-11-18'), '2026-11-20')
  assert.equal(dateInQuestion('November 20', '2026-11-18'), '2026-11-20')
  assert.equal(dateInQuestion('20 November', '2026-11-18'), '2026-11-20')
  assert.deepEqual(dateWindow('next week', '2026-11-18'), { from: '2026-11-23', to: '2026-11-29' })
  assert.equal(timeInQuestion('10', ['10:00 AM']), '10:00 AM')
  assert.equal(timeInQuestion('10', ['10:00 AM', '10:00 PM']), null)
  assert.equal(timeInQuestion('10am'), '10:00 AM')
  assert.equal(dateInQuestion('Friday next week', '2026-11-18'), '2026-11-27')
})

test('an impossible named date clears a previous date instead of preparing the old visit', async () => {
  const { chat, calls } = fixture()
  const result = await chat({ actor: patient, body: { message: 'Book February 30 at 10 AM', conversation: { topic: 'booking', doctorId: doctors[0].id, date: '2026-11-19', time: '10:00 AM' } } })
  assert.match(result.reply, /isn’t on the calendar/)
  assert.equal(result.bookingDraft, null)
  assert.equal(result.conversation.date, undefined)
  assert.equal(result.conversation.time, undefined)
  assert.equal(calls.length, 0)
})

test('unmatched patient name never reuses a previously viewed patient record', async () => {
  const { chat, calls } = fixture()
  const result = await chat({ actor: doctor, body: { message: 'Tell me about Bob Example', conversation: { topic: 'record', appointmentId: '444444444444444444444444', from: '2026-11-18', to: '2026-11-18' } } })
  assert.match(result.reply, /couldn’t identify/)
  assert.equal(result.conversation.appointmentId, undefined)
  assert.equal(calls.some((c) => c.name === 'get_patient_context'), false)
})

test('record ordinal keeps the displayed appointment identity when the upcoming list changes', async () => {
  const original = '555555555555555555555555'
  const { chat, calls } = fixture()
  await chat({ actor: doctor, body: { message: 'Tell me about the first patient', conversation: { topic: 'schedule', from: '2026-11-18', to: '2026-11-18', appointmentOptions: [original] } } })
  assert.equal(calls.at(-1).args.appointmentId, original)
})

test('show all retains the upcoming view; explicit canceled appointments use a status filter', async () => {
  const { chat, calls } = fixture()
  const result = await chat({ actor: doctor, body: { message: 'My schedule today' } })
  await chat({ actor: doctor, body: { message: 'Show all', conversation: result.conversation } })
  assert.equal(calls.at(-1).args.view, 'upcoming')
  await chat({ actor: doctor, body: { message: 'My canceled appointments today', conversation: result.conversation } })
  assert.equal(calls.at(-1).args.view, 'all')
  assert.equal(calls.at(-1).args.status, 'Canceled')
})

test('health education overrides generic record and specialty navigation', async () => {
  const { chat, calls } = fixture()
  const reference = await chat({ actor: doctor, body: { message: 'Tell me about diabetes', conversation: { topic: 'schedule' } } })
  assert.equal(reference.verifiedReference, true)
  assert(reference.sources.length)
  const unknown = await chat({ actor: guest, body: { message: 'What is cardiology?' } })
  assert.match(unknown.reply, /verified reference/)
  assert.equal(calls.length, 0)
})

test('unrecognized medical wording cannot accept a planner social medical reply', async () => {
  const { chat } = fixture({ capacity: (work) => work(), generate: async () => ({ content: JSON.stringify({ intent: 'chat', reply: 'Take aspirin and rest.' }) }) })
  for (const message of ['I feel sick. What should I do?', 'Something feels wrong with my body. Any advice?']) {
    const result = await chat({ actor: guest, body: { message } })
    assert.doesNotMatch(result.reply, /aspirin/)
  }
})

test('next available searches forward from a day with no slots', async () => {
  const { chat } = fixture({ runTool: async ({ name, args }) => {
    if (name === 'find_doctors') return { doctors }
    return { doctor: doctors[0], date: args.date, slots: args.date === '2026-11-20' ? ['11:00 AM'] : [] }
  } })
  const result = await chat({ actor: patient, body: { message: 'Next available time', conversation: { topic: 'booking', doctorId: doctors[0].id, date: '2026-11-19' } } })
  assert.equal(result.conversation.date, '2026-11-20')
  assert.match(result.reply, /11:00 AM/)
  assert.equal(result.bookingDraft, null)
})
