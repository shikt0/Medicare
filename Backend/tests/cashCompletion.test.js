import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCashPaymentOnCompletion } from '../utils/cashCompletion.js'

const completedAt = new Date('2026-09-19T08:00:00.000Z')

test('cash completion requires an explicit received or unpaid decision', () => {
  const result = evaluateCashPaymentOnCompletion({
    fees: 500,
    payment: { method: 'Cash', status: 'Pending', amount: 500 },
  }, undefined, completedAt)

  assert.equal(result.ok, false)
  assert.equal(result.requiresDecision, true)
})

test('received cash becomes paid at completion', () => {
  const result = evaluateCashPaymentOnCompletion({
    fees: 500,
    payment: { method: 'Cash', status: 'Pending', amount: 500 },
  }, true, completedAt)

  assert.equal(result.ok, true)
  assert.equal(result.paymentStatus, 'Paid')
  assert.equal(result.amount, 500)
  assert.equal(result.paidAt, completedAt)
})

test('unreceived cash remains pending and has no paid timestamp', () => {
  const result = evaluateCashPaymentOnCompletion({
    fees: 500,
    payment: { method: 'Cash', status: 'Pending', amount: 500 },
  }, false, completedAt)

  assert.equal(result.ok, true)
  assert.equal(result.paymentStatus, 'Pending')
  assert.equal(result.paidAt, null)
})

test('online, already-paid, and free tasks do not require a cash decision', () => {
  const records = [
    { fees: 500, payment: { method: 'Online', status: 'Paid', amount: 500 } },
    { fees: 500, payment: { method: 'Cash', status: 'Paid', amount: 500 } },
    { fees: 0, payment: { method: 'Cash', status: 'Pending', amount: 0 } },
  ]

  records.forEach((record) => {
    const result = evaluateCashPaymentOnCompletion(record, undefined, completedAt)
    assert.equal(result.ok, true)
    assert.equal(result.requiresDecision, false)
  })
})
