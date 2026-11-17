import test from 'node:test'
import assert from 'node:assert/strict'
import Appointment from '../models/Appointment.js'
import ServiceAppointment from '../models/serviceAppointment.js'
import { bookingCurrency, getPaymentCurrency, sumBookingCurrencies } from '../utils/paymentCurrency.js'

test('new bookings use BDT by default and accept explicit INR or BDT configuration', () => {
  assert.equal(getPaymentCurrency(''), 'bdt')
  assert.equal(getPaymentCurrency(' BDT '), 'bdt')
  assert.equal(getPaymentCurrency('INR'), 'inr')
  assert.throws(() => getPaymentCurrency('USD'), /PAYMENT_CURRENCY must be BDT or INR/)
})

test('both booking models preserve explicit checkout currency without rewriting historical records', () => {
  for (const Model of [Appointment, ServiceAppointment]) {
    assert.equal(new Model({ payment: { currency: 'bdt' } }).toObject().payment.currency, 'bdt')
    assert.equal(new Model({ payment: { currency: 'inr' } }).toObject().payment.currency, 'inr')
    assert.equal(new Model({ payment: { method: 'Cash' } }).toObject().payment.currency, undefined)
    assert.equal(new Model({ payment: { method: 'Online' } }).toObject().payment.currency, undefined)
  }
})

test('historical cash remains BDT while historical online checkout remains INR', () => {
  assert.equal(bookingCurrency({ payment: { method: 'Cash' } }), 'bdt')
  assert.equal(bookingCurrency({ payment: { method: 'Online' } }), 'inr')
  assert.equal(bookingCurrency({ payment: { method: 'Online', currency: 'bdt' } }), 'bdt')
  assert.equal(bookingCurrency({ payment: { method: 'Cash', currency: 'inr' } }), 'inr')
})

test('earnings group cash and online bookings by their original currency', () => {
  const totals = sumBookingCurrencies([
    { fees: 100, payment: { method: 'Cash' } },
    { fees: 80, payment: { method: 'Online' } },
    { fees: 200, payment: { method: 'Online', currency: 'bdt' } },
    { fees: 50, payment: { method: 'Cash', currency: 'inr' } },
  ])
  assert.deepEqual(totals, { bdt: 300, inr: 130 })
})
