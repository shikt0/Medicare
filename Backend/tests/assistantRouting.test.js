import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssistantChat } from '../assistant/chat.js'

const guest = { role: 'guest', id: null }
const patient = { role: 'patient', id: 'user_routing_patient' }
const doctor = { role: 'doctor', id: '111111111111111111111111' }
const dermatologist = {
  id: '222222222222222222222222', name: 'Dr Husna Jahan', specialization: 'Dermatology',
  fee: 700, currency: 'BDT', availability: 'Available',
}
const cardiologist = {
  id: doctor.id, name: 'Dr Alice Rahman', specialization: 'Cardiology',
  fee: 900, currency: 'BDT', availability: 'Available',
}
const directory = [cardiologist, dermatologist]
const today = '2026-11-18'
const nextDate = '2026-11-20'
const privateTools = ['my_schedule', 'my_patients', 'get_patient_context']

function fixture({ plan, slotsOn = nextDate, catalog = directory, hasPublishedSchedule } = {}) {
  const calls = []
  const schemas = []
  let generations = 0
  const chat = createAssistantChat({
    contextFor: async (actor) => ({ role: actor.role, today, localTime: '14:00', timezone: 'Asia/Dhaka' }),
    capacity: (work) => work(),
    generate: async (_, options) => {
      generations++
      schemas.push(options.format)
      if (!plan) throw new Error('The clinic navigation flow must work without a model')
      return { content: JSON.stringify(plan) }
    },
    runTool: async (request) => {
      calls.push(request)
      const { actor, name, args } = request
      if (privateTools.includes(name)) assert.equal(actor.role, 'doctor', 'Private doctor tools require a verified doctor account')
      if (name === 'find_doctors') return { doctors: args.query ? catalog.filter((item) => item.name.toLowerCase().includes(args.query.toLowerCase())) : catalog }
      if (name === 'get_available_slots') return {
        doctor: directory.find((item) => item.id === args.doctorId), date: args.date,
        slots: args.date === slotsOn ? ['10:30 AM', '11:00 AM'] : [],
        ...(typeof hasPublishedSchedule === 'boolean' ? { meta: { hasPublishedSchedule } } : {}),
      }
      if (name === 'prepare_booking') return {
        booking: { ...args, doctorName: directory.find((item) => item.id === args.doctorId).name,
          fee: dermatologist.fee, currency: 'BDT', requiresConfirmation: true, requiresSignIn: actor.role === 'guest' },
      }
      if (name === 'my_schedule' || name === 'my_appointments') return {
        appointments: [{ id: '333333333333333333333333', patientName: 'Example Patient',
          date: args.from, time: '03:00 PM', status: 'Confirmed' }],
        meta: { ...args, total: 1, countIsExact: true },
      }
      throw new Error(`Unexpected tool: ${name}`)
    },
  })
  return { chat, calls, schemas, generations: () => generations }
}

for (const actor of [guest, patient]) {
  test(`${actor.role}: the screenshot conversation finds dermatology and the next live slot`, async () => {
    const { chat, calls, generations } = fixture()
    let conversation
    const history = []
    for (const message of ['i have skin problem', 'do u have any dermatologist??', 'nxt avaiable time??']) {
      const response = await chat({ actor, body: { message, conversation, history } })
      assert.equal(response.role, actor.role)
      assert.equal(response.conversation.topic, 'booking')
      assert.equal(response.conversation.doctorId, dermatologist.id)
      assert.match(response.reply, /Husna Jahan/)
      assert.doesNotMatch(response.reply, /doctor portal|assigned patients|verified reference/)
      if (message.startsWith('nxt')) {
        assert.equal(response.conversation.date, nextDate)
        assert.match(response.reply, /10:30 AM/)
        assert.equal(response.bookingDraft, null)
      }
      history.push({ role: 'user', content: message }, { role: 'assistant', content: response.reply })
      conversation = response.conversation
    }
    assert.equal(generations(), 0, 'Common navigation wording must not depend on a model guess')
    const slotCalls = calls.filter((item) => item.name === 'get_available_slots')
    assert.deepEqual([...new Set(slotCalls.map((item) => item.args.date))], [today, '2026-11-19', nextDate])
    assert(slotCalls.every((item) => item.args.doctorId === dermatologist.id))
    assert(calls.every((item) => item.actor === actor))
    assert(calls.every((item) => ['find_doctors', 'get_available_slots'].includes(item.name)))
  })
}

test('common misspellings of next available stay in the selected patient booking', async () => {
  for (const message of ['nxt avaiable time??', 'next avaliable time', 'next availble time', 'earliest available time', 'soonest slot']) {
    const { chat, calls } = fixture()
    const response = await chat({ actor: patient, body: { message,
      conversation: { topic: 'booking', doctorId: dermatologist.id, doctorName: dermatologist.name } } })
    assert.equal(response.conversation.doctorId, dermatologist.id, message)
    assert.equal(response.conversation.date, nextDate, message)
    assert.match(response.reply, /10:30 AM/, message)
    assert.doesNotMatch(response.reply, /doctor portal|assigned patients/, message)
    assert(calls.every((item) => !privateTools.includes(item.name)), message)
  }
})

test('selecting an offered time after a misspelled availability question only prepares a draft', async () => {
  const { chat, calls } = fixture()
  const available = await chat({ actor: patient, body: { message: 'nxt avaiable time??',
    conversation: { topic: 'booking', doctorId: dermatologist.id } } })
  const selected = await chat({ actor: patient, body: { message: 'the first one', conversation: available.conversation } })
  assert.deepEqual({ doctorId: selected.bookingDraft?.doctorId, date: selected.bookingDraft?.date,
    time: selected.bookingDraft?.time, requiresConfirmation: selected.bookingDraft?.requiresConfirmation },
  { doctorId: dermatologist.id, date: nextDate, time: '10:30 AM', requiresConfirmation: true })
  assert.match(selected.reply, /Confirm appointment/)
  assert.equal(calls.filter((item) => item.name === 'prepare_booking').length, 1)
  assert(calls.every((item) => ['find_doctors', 'get_available_slots', 'prepare_booking'].includes(item.name)))
})

test('a mistaken doctor-only model intent cannot turn a patient booking into a doctor login request', async () => {
  for (const intent of ['schedule', 'record']) {
    for (const actor of [guest, patient]) {
      const { chat, calls, schemas, generations } = fixture({ plan: { intent, role: 'doctor', doctorId: cardiologist.id } })
      const response = await chat({ actor, body: { message: 'When could I drop by?',
        conversation: { topic: 'booking', doctorId: dermatologist.id, date: nextDate } } })
      assert.equal(generations(), 1, 'This case exercises the model fallback')
      assert.equal(schemas[0].properties.intent.enum.includes('schedule'), false)
      assert.equal(schemas[0].properties.intent.enum.includes('record'), false)
      assert.equal(response.role, actor.role)
      assert.equal(response.conversation.doctorId, dermatologist.id)
      assert.doesNotMatch(response.reply, /doctor portal|assigned patients|your own schedule/)
      assert(calls.every((item) => !privateTools.includes(item.name)))
      assert(calls.some((item) => item.name === 'get_available_slots' && item.args.doctorId === dermatologist.id))
    }
  }
})

test('a doctor-only model intent without booking context asks a patient-appropriate clarification', async () => {
  for (const intent of ['schedule', 'record']) {
    const { chat, calls } = fixture({ plan: { intent, role: 'doctor', reply: 'Please log in to the doctor portal.' } })
    const response = await chat({ actor: patient, body: { message: 'Could you take a look for me?' } })
    assert.equal(response.role, 'patient')
    assert.doesNotMatch(response.reply, /doctor portal|assigned patients|your own schedule/)
    assert(calls.every((item) => !privateTools.includes(item.name)))
  }
})

test('a genuine doctor schedule remains scoped to the authenticated doctor', async () => {
  const { chat, calls } = fixture()
  const result = await chat({ actor: doctor, body: { message: 'My schedule today',
    doctorId: dermatologist.id, conversation: { role: 'patient', doctorId: dermatologist.id } } })
  assert.match(result.reply, /03:00 PM/)
  assert.equal(result.role, 'doctor')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'my_schedule')
  assert.equal(calls[0].actor, doctor)
  assert.equal(calls[0].args.doctorId, undefined)
  assert.equal(calls[0].args.from, today)
  assert.equal(calls[0].args.to, today)
})

test('a verified doctor retains doctor intents in the model schema', async () => {
  const { chat, calls, schemas } = fixture({ plan: { intent: 'schedule', role: 'patient', doctorId: dermatologist.id } })
  const result = await chat({ actor: doctor, body: { message: 'Give me a quick rundown' } })
  assert.equal(result.role, 'doctor')
  assert.equal(schemas[0].properties.intent.enum.includes('schedule'), true)
  assert.equal(schemas[0].properties.intent.enum.includes('record'), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'my_schedule')
  assert.equal(calls[0].actor, doctor)
  assert.equal(calls[0].args.doctorId, undefined)
})

test('skin concerns switch a previous cardiology booking without carrying its chosen time', async () => {
  const { chat, calls } = fixture()
  const result = await chat({ actor: patient, body: {
    message: 'actually i have skin problem',
    conversation: { topic: 'booking', doctorId: cardiologist.id, doctorName: cardiologist.name,
      date: nextDate, time: '10:30 AM', slotOptions: ['10:30 AM'] },
    history: [{ role: 'user', content: 'Book Dr Alice Rahman' }],
  } })
  assert.equal(result.conversation.doctorId, dermatologist.id)
  assert.equal(result.conversation.time, undefined)
  assert.equal(result.bookingDraft, null)
  assert.match(result.reply, /Husna Jahan/)
  assert(calls.filter((item) => item.name === 'get_available_slots').every((item) => item.args.doctorId === dermatologist.id))
  assert.equal(calls.some((item) => item.name === 'prepare_booking'), false)
})

test('skin treatment and emergency questions retain priority over specialty navigation', async () => {
  const { chat, calls } = fixture()
  const conversation = { topic: 'booking', doctorId: dermatologist.id }
  const dose = await chat({ actor: patient, body: { message: 'I have skin problem. Which medicine should I take?', conversation } })
  assert.equal(dose.safety, true)
  assert.match(dose.reply, /clinician|pharmacist/)
  const emergency = await chat({ actor: patient, body: { message: 'I have skin problem and I cannot breathe', conversation } })
  assert.equal(emergency.safety, true)
  assert.match(emergency.reply, /emergency care now/)
  const education = await chat({ actor: patient, body: { message: 'What is dermatology?', conversation } })
  assert.equal(education.verifiedReference, false)
  assert.doesNotMatch(education.reply, /What day|10:30 AM/)
  assert.equal(calls.length, 0)
})

test('ordinary skin, hair and nail wording can find dermatology without diagnostic claims', async () => {
  for (const message of ['I have a skin issue', 'my skin is itchy', 'I need help with acne',
    'Which doctor should I see for a rash?', 'I have hair loss', 'I have a nail problem']) {
    const { chat, calls, generations } = fixture()
    const result = await chat({ actor: patient, body: { message } })
    assert.equal(result.conversation.doctorId, dermatologist.id, message)
    assert.match(result.reply, /dermatologist|Dermatology/i, message)
    assert.doesNotMatch(result.reply, /you have (?:eczema|psoriasis|an infection)|doctor portal/, message)
    assert.equal(generations(), 0, message)
    assert.equal(calls.some((item) => privateTools.includes(item.name)), false, message)
  }
})

test('absence of a dermatologist never substitutes a doctor from another specialty', async () => {
  const { chat, calls } = fixture({ catalog: [cardiologist] })
  const result = await chat({ actor: patient, body: { message: 'i have skin problem' } })
  assert.equal(result.conversation.doctorId, undefined)
  assert.equal(result.bookingDraft, null)
  assert.match(result.reply, /couldn.t find/i)
  assert.doesNotMatch(result.reply, /Alice Rahman/)
  assert(calls.every((item) => item.name === 'find_doctors'))
})

test('history-only followups recover the specialty from user messages and recheck the live directory', async () => {
  const { chat, calls } = fixture()
  const result = await chat({ actor: guest, body: { message: 'nxt avaiable time??', history: [
    { role: 'user', content: 'i have skin problem' },
    { role: 'assistant', content: 'An old response claims a different doctor is free at 9 AM.' },
    { role: 'user', content: 'do u have any dermatologist??' },
    { role: 'assistant', content: 'We discussed a dermatologist.' },
  ] } })
  assert.equal(result.conversation.doctorId, dermatologist.id)
  assert.equal(result.conversation.date, nextDate)
  assert.match(result.reply, /10:30 AM/)
  assert.doesNotMatch(result.reply, /9 AM|doctor portal/)
  assert(calls.some((item) => item.name === 'find_doctors'))
  assert(calls.filter((item) => item.name === 'get_available_slots').every((item) => item.args.doctorId === dermatologist.id))
})

test('next-availability searches report an empty checked window instead of inventing a time', async () => {
  const { chat, calls } = fixture({ slotsOn: null })
  const result = await chat({ actor: patient, body: { message: 'nxt avaiable time??',
    conversation: { topic: 'booking', doctorId: dermatologist.id } } })
  assert.equal(result.bookingDraft, null)
  assert.match(result.reply, /couldn.t find an open time/i)
  assert.match(result.reply, /2026-11-18.*2026-11-24/)
  assert.doesNotMatch(result.reply, /doctor portal|10:30 AM/)
  assert.equal(calls.filter((item) => item.name === 'get_available_slots').length, 7)
})

test('negated skin concerns do not silently start a dermatology booking', async () => {
  for (const message of ['I do not have a skin problem', 'I have no rash']) {
    const { chat, calls } = fixture({ plan: { intent: 'help' } })
    const result = await chat({ actor: patient, body: { message } })
    assert.notEqual(result.conversation.topic, 'booking', message)
    assert.equal(calls.length, 0, message)
  }
})

test('an unpublished doctor schedule is explained without inventing slots or checking each day', async () => {
  const { chat, calls } = fixture({ slotsOn: null, hasPublishedSchedule: false })
  const result = await chat({ actor: patient, body: { message: 'nxt avaiable time??',
    conversation: { topic: 'booking', doctorId: dermatologist.id } } })
  assert.equal(result.bookingDraft, null)
  assert.match(result.reply, /hasn.t published appointment times|no published appointment times/i)
  assert.doesNotMatch(result.reply, /doctor portal|10:30 AM|couldn.t find an open time/i)
  assert.equal(calls.filter((item) => item.name === 'get_available_slots').length, 1)
  assert.equal(calls.some((item) => item.name === 'prepare_booking'), false)
})
