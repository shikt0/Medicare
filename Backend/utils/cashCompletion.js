export function evaluateCashPaymentOnCompletion(record, cashPaymentReceived, now = new Date()) {
  const paymentMethod = String(record?.payment?.method || '').trim().toLowerCase()
  const paymentStatus = String(record?.payment?.status || '').trim().toLowerCase()
  const amount = Number(record?.fees ?? record?.payment?.amount ?? 0)
  const requiresDecision = paymentMethod === 'cash' && paymentStatus !== 'paid' && amount > 0

  if (!requiresDecision) return { ok: true, requiresDecision: false }

  if (typeof cashPaymentReceived !== 'boolean') {
    return {
      ok: false,
      requiresDecision: true,
      message: 'Confirm whether the cash payment was received before completing this task',
    }
  }

  return {
    ok: true,
    requiresDecision: true,
    cashPaymentReceived,
    paymentStatus: cashPaymentReceived ? 'Paid' : 'Pending',
    amount: Number.isFinite(amount) ? amount : 0,
    paidAt: cashPaymentReceived ? now : null,
    confirmedAt: now,
  }
}
