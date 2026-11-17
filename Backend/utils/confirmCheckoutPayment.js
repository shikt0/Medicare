// A checkout session can only settle the booking that owns that exact session.
// Never infer a booking from an amount, patient name, or creation timestamp.
export function createPaymentConfirmationHandler({ model, getStripe, sessionPath, paidAtPath }) {
  return async function confirmCheckoutPayment(req, res) {
    try {
      if (!req.actor?.id) {
        return res.status(401).json({ success: false, message: 'Authentication required' })
      }
      const sessionId = req.query.session_id || req.query.session_Id
      if (typeof sessionId !== 'string' || !sessionId.trim()) {
        return res.status(400).json({ success: false, message: 'Payment session ID is required' })
      }

      const filter = { [sessionPath]: sessionId.trim() }
      if (req.actor.role !== 'admin') filter.createdBy = req.actor.id
      const appointment = await model.findOne(filter).lean()
      if (!appointment) {
        return res.status(404).json({ success: false, message: 'Appointment not found for this payment session' })
      }
      if (['Paid', 'Refunded'].includes(appointment.payment?.status)) {
        return res.json({ success: true, appointment })
      }

      const stripe = getStripe()
      if (!stripe) {
        return res.status(503).json({ success: false, message: 'Online payments are temporarily unavailable' })
      }
      let session
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId.trim())
      } catch {
        return res.status(502).json({ success: false, message: 'Unable to verify the payment. Please try again.' })
      }
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ success: false, message: 'Payment not completed' })
      }
      const expectedAmount = Math.round(Number(appointment.fees) * 100)
      if (session.id !== sessionId.trim()
        || session.mode !== 'payment'
        || session.currency !== (appointment.payment?.currency || 'inr')
        || !Number.isSafeInteger(expectedAmount)
        || expectedAmount < 0
        || session.amount_total !== expectedAmount
        || appointment.payment?.method !== 'Online'
        || (session.metadata?.clerkUserId && session.metadata.clerkUserId !== appointment.createdBy)) {
        return res.status(409).json({ success: false, message: 'Payment does not match this appointment' })
      }

      const updates = {
        'payment.status': 'Paid',
        'payment.providerId': typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '',
        [paidAtPath]: new Date(),
      }
      // A return-page refresh must not reopen canceled/completed visits or undo a reschedule.
      if (appointment.status === 'Pending') updates.status = 'Confirmed'
      const updated = await model.findOneAndUpdate({
        ...filter,
        _id: appointment._id,
        status: appointment.status,
        'payment.status': appointment.payment?.status,
      }, { $set: updates }, { new: true, runValidators: true })
      if (!updated) {
        const current = await model.findOne(filter).lean()
        if (current && ['Paid', 'Refunded'].includes(current.payment?.status)) {
          return res.json({ success: true, appointment: current })
        }
        return res.status(409).json({ success: false, message: 'This appointment changed. Please retry payment verification.' })
      }
      return res.json({ success: true, appointment: updated })
    } catch (error) {
      console.error('Payment confirmation error:', error)
      return res.status(500).json({ success: false, message: 'Unable to confirm the payment' })
    }
  }
}
