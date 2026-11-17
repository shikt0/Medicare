# Payment currency

New appointment and service bookings use Bangladeshi taka (`bdt`) by default. Set
`PAYMENT_CURRENCY=BDT` or `PAYMENT_CURRENCY=INR` to choose the currency for new
bookings. Other values are rejected. Use the matching `VITE_CURRENCY` setting in
both frontend apps. Existing numeric catalog prices are not converted.

Every new cash, free, and Stripe booking stores `payment.currency`. Stripe
checkout and payment confirmation use that saved currency. A later configuration
change does not change an existing booking's currency.

Historical online bookings without `payment.currency` retain INR, matching the
original checkout implementation. Historical cash bookings retain BDT, matching
the original patient-facing cash prices. Confirmation of historical Stripe
sessions therefore continues to require INR.

API revenue breakdowns keep these currencies separate:

- Appointment statistics: `stats.revenueByCurrency`.
- Doctor administration records: `earningsByCurrency`.
- Service statistics: each service's `earningsByCurrency` and
  `summary.earningsByCurrency`.

Breakdowns have `bdt` and `inr` numeric keys. The old scalar revenue fields remain
for API compatibility; clients must use the breakdowns when presenting money.
Only completed, paid appointments contribute to earnings.

The server validates confirmed payments against the authenticated booking owner,
exact checkout session, stored currency, and fee. Repeated confirmation preserves
completed, canceled, rescheduled, and refunded records. Cancellation records the
visit as canceled; it does not claim a refund was issued.
