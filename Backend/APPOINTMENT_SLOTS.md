# Required appointment-slot index

Doctor appointments require a database unique index on `doctorId`, `date`, and
`time` for `Pending`, `Confirmed`, `Completed`, and `Rescheduled` records.
Canceled records release their slot. The database rejects simultaneous writes
to an occupied slot; the API returns HTTP 409 with `APPOINTMENT_SLOT_TAKEN`.

The index is **not installed automatically**. Until it is installed and verified,
doctor appointment creation and rescheduling return HTTP 503 with
`BOOKING_INDEX_REQUIRED`. Service requests do not reserve doctor time slots.

From the `Backend` directory, with the intended `MONGODB_URI` configured:

```powershell
node scripts/migrateAppointmentSlots.js --check
```

This check is read-only. It prints index presence and conflict/invalid-record
counts. To also see affected record IDs (without patient names or slot values):

```powershell
node scripts/migrateAppointmentSlots.js --check --show-conflicts
```

After reviewing the target database and a clean check, install the index:

```powershell
npm run db:migrate:appointment-slots
```

The command refuses to install if active bookings conflict or contain invalid or
noncanonical dates/times. It never deletes, merges, reschedules, or overwrites
appointments. Resolve those records through an explicit data review, then rerun
the check. Index-creation failures exit nonzero; the API continues to reject new
bookings until the required index is available. A clean check without an index
also exits nonzero because booking is not yet ready.

The migration requires a MongoDB release supporting `$in` in partial-index
filters. The implementation follows MongoDB's
[partial unique index documentation](https://www.mongodb.com/docs/manual/core/index-partial/).
MongoDB checks uniqueness during index creation, so conflicting concurrent writes
cannot silently bypass the migration.
