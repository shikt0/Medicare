import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaymentConfirmationHandler } from '../utils/confirmCheckoutPayment.js'

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

function setup({ sessionPath = 'sessionId', status = 'Pending', paymentStatus = 'Pending', owner = 'patient-1', sessionChanges = {}, currency } = {}) {
  const booking = { _id: 'booking-1', createdBy: owner, status, fees: 99.95, payment: { method: 'Online', status: paymentStatus, currency } }
  const session = { id: 'cs_booking_1', payment_status: 'paid', mode: 'payment', currency: 'inr', amount_total: 9995, payment_intent: 'pi_1', metadata: { clerkUserId: owner }, ...sessionChanges }
  const queries = []
  const writes = []
  let retrieveCount = 0
  const model = {
    findOne(filter) {
      queries.push(filter)
      return { lean: async () => filter[sessionPath] === 'cs_booking_1' && (!filter.createdBy || filter.createdBy === owner) ? booking : null }
    },
    async findOneAndUpdate(filter, update) {
      writes.push({ filter, update })
      return { ...booking, status: update.$set.status || booking.status, payment: { ...booking.payment, status: update.$set['payment.status'] } }
    },
  }
  const handler = createPaymentConfirmationHandler({ model, getStripe: () => ({ checkout: { sessions: { retrieve: async () => { retrieveCount += 1; return session } } } }), sessionPath, paidAtPath: sessionPath === 'sessionId' ? 'paidAt' : 'payment.paidAt' })
  const request = { actor: { id: 'patient-1', role: 'patient' }, query: { session_id: 'cs_booking_1' } }
  return { handler, request, queries, writes, retrieveCount: () => retrieveCount }
}

for (const sessionPath of ['sessionId', 'payment.sessionId']) {
  test(`${sessionPath}: payment belongs to the exact session and authenticated patient`, async () => {
    const fixture = setup({ sessionPath })
    const res = responseRecorder()
    await fixture.handler(fixture.request, res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.payload.appointment.status, 'Confirmed')
    assert.deepEqual(fixture.queries[0], { [sessionPath]: 'cs_booking_1', createdBy: 'patient-1' })
    assert.equal(fixture.writes[0].filter['payment.status'], 'Pending')
  })

  test(`${sessionPath}: unknown sessions and another patient's sessions never fall back to another booking`, async () => {
    for (const overrides of [{ query: { session_id: 'cs_unknown' } }, { actor: { id: 'patient-2', role: 'patient' } }]) {
      const fixture = setup({ sessionPath })
      const res = responseRecorder()
      await fixture.handler({ ...fixture.request, ...overrides }, res)
      assert.equal(res.statusCode, 404)
      assert.equal(fixture.writes.length, 0)
      assert.equal(fixture.queries.length, 1)
      assert.equal(fixture.retrieveCount(), 0)
    }
  })

  test(`${sessionPath}: repeat confirmation preserves completed/refunded records`, async () => {
    for (const paymentStatus of ['Paid', 'Refunded']) {
      const fixture = setup({ sessionPath, status: 'Completed', paymentStatus })
      const res = responseRecorder()
      await fixture.handler(fixture.request, res)
      assert.equal(res.payload.appointment.status, 'Completed')
      assert.equal(res.payload.appointment.payment.status, paymentStatus)
      assert.equal(fixture.writes.length, 0)
      assert.equal(fixture.retrieveCount(), 0)
    }
  })

  test(`${sessionPath}: payment verification cannot reopen canceled visits or undo reschedules`, async () => {
    for (const status of ['Canceled', 'Completed', 'Rescheduled']) {
      const fixture = setup({ sessionPath, status })
      const res = responseRecorder()
      await fixture.handler(fixture.request, res)
      assert.equal(res.payload.appointment.status, status)
      assert.equal(res.payload.appointment.payment.status, 'Paid')
      assert.equal(Object.hasOwn(fixture.writes[0].update.$set, 'status'), false)
    }
  })
}

test('confirmation rejects unauthenticated or malformed requests without a database write', async () => {
  for (const [request, code] of [[{ query: {} }, 401], [{ actor: { id: 'patient-1' }, query: { session_id: ['cs_1'] } }, 400]]) {
    const fixture = setup()
    const res = responseRecorder()
    await fixture.handler(request, res)
    assert.equal(res.statusCode, code)
    assert.equal(fixture.queries.length, 0)
  }
})

test('confirmation rejects mismatched amount, currency, owner metadata, mode, and session ID', async () => {
  for (const sessionChanges of [{ amount_total: 9994 }, { currency: 'usd' }, { metadata: { clerkUserId: 'patient-2' } }, { mode: 'subscription' }, { id: 'cs_other' }]) {
    const fixture = setup({ sessionChanges })
    const res = responseRecorder()
    await fixture.handler(fixture.request, res)
    assert.equal(res.statusCode, 409)
    assert.equal(fixture.writes.length, 0)
  }
})

test('unpaid checkouts cannot confirm bookings', async () => {
  const fixture = setup({ sessionChanges: { payment_status: 'unpaid' } })
  const res = responseRecorder()
  await fixture.handler(fixture.request, res)
  assert.equal(res.statusCode, 400)
  assert.equal(fixture.writes.length, 0)
})

test('BDT sessions verify against the persisted booking currency', async () => {
  for (const sessionPath of ['sessionId', 'payment.sessionId']) {
    const fixture = setup({ sessionPath, currency: 'bdt', sessionChanges: { currency: 'bdt' } })
    const res = responseRecorder()
    await fixture.handler(fixture.request, res)
    assert.equal(res.statusCode, 200)
    assert.equal(fixture.writes.length, 1)
  }
})

test('legacy INR sessions remain verifiable after the configured currency changes to BDT', async () => {
  const previous = process.env.PAYMENT_CURRENCY
  process.env.PAYMENT_CURRENCY = 'bdt'
  try {
    for (const currency of [undefined, 'inr']) {
      const fixture = setup({ currency })
      const res = responseRecorder()
      await fixture.handler(fixture.request, res)
      assert.equal(res.statusCode, 200)
      assert.equal(fixture.writes.length, 1)
    }
  } finally {
    if (previous === undefined) delete process.env.PAYMENT_CURRENCY
    else process.env.PAYMENT_CURRENCY = previous
  }
})

test('a BDT payment cannot settle an INR booking or a legacy INR checkout', async () => {
  for (const currency of [undefined, 'inr']) {
    const fixture = setup({ currency, sessionChanges: { currency: 'bdt' } })
    const res = responseRecorder()
    await fixture.handler(fixture.request, res)
    assert.equal(res.statusCode, 409)
    assert.equal(fixture.writes.length, 0)
  }
})
