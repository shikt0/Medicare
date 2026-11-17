export function confirmedPaymentState(appointment) {
  if (appointment?.payment?.status === 'Refunded') return 'refunded'
  if (appointment?.status === 'Canceled') return 'booking-canceled'
  if (appointment?.status === 'Completed') return 'completed'
  if (appointment?.status === 'Rescheduled') return 'rescheduled'
  return 'success'
}
