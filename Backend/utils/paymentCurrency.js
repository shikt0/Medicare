export const PAYMENT_CURRENCIES = ['bdt', 'inr']

export function getPaymentCurrency(value = process.env.PAYMENT_CURRENCY) {
  const currency = String(value || 'bdt').trim().toLowerCase()
  if (!PAYMENT_CURRENCIES.includes(currency)) {
    throw new Error('PAYMENT_CURRENCY must be BDT or INR')
  }
  return currency
}

export function bookingCurrency(booking) {
  return booking.payment?.currency || (booking.payment?.method === 'Online' ? 'inr' : 'bdt')
}

export function sumBookingCurrencies(bookings) {
  return bookings.reduce((totals, booking) => {
    const currency = bookingCurrency(booking)
    totals[currency] = (totals[currency] || 0) + Number(booking.fees || 0)
    return totals
  }, { bdt: 0, inr: 0 })
}

export function paymentCurrencyExpression(path = '$payment') {
  return { $ifNull: [`${path}.currency`, { $cond: [{ $eq: [`${path}.method`, 'Online'] }, 'inr', 'bdt'] }] }
}

export function paidAppointmentTotalsExpression(path = '$appointments', fallback = 0) {
  return Object.fromEntries(PAYMENT_CURRENCIES.map((currency) => [currency, {
    $sum: {
      $map: {
        input: {
          $filter: {
            input: path,
            as: 'booking',
            cond: { $and: [
              { $eq: ['$$booking.status', 'Completed'] },
              { $eq: ['$$booking.payment.status', 'Paid'] },
              { $eq: [paymentCurrencyExpression('$$booking.payment'), currency] },
            ] },
          },
        },
        as: 'booking',
        in: { $ifNull: ['$$booking.fees', fallback] },
      },
    },
  }]))
}
