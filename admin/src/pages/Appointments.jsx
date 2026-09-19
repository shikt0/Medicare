import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  LoaderCircle,
  Phone,
  RefreshCw,
  Search,
  Stethoscope,
  UserRound,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import { doctorNameFromAppointment, formatCurrency, formatDate, getId } from '../lib/format'

const PAGE_SIZE = 12
const STATUS_FILTERS = ['', 'Pending', 'Confirmed', 'Rescheduled', 'Completed', 'Canceled']
const initialStats = {
  total: 0,
  revenue: 0,
  recentLast7Days: 0,
  statusCounts: { Pending: 0, Confirmed: 0, Rescheduled: 0, Completed: 0, Canceled: 0 },
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0 })
  const [stats, setStats] = useState(initialStats)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [workingId, setWorkingId] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const requestSequence = useRef(0)

  const fetchAppointments = useCallback(async (params, quiet = false) => {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    if (!quiet) setLoading(true)
    setError('')

    try {
      const payload = await api.getAppointmentsPage(params)
      if (requestId !== requestSequence.current) return false
      const records = payload.appointment || payload.appointments || []
      const nextMeta = payload.meta || { page: params.page, limit: PAGE_SIZE, total: records.length }
      setAppointments(Array.isArray(records) ? records : [])
      setMeta(nextMeta)

      if (params.page > 1 && records.length === 0 && nextMeta.total > 0) {
        setPage(params.page - 1)
      }
      return true
    } catch (loadError) {
      if (requestId !== requestSequence.current) return false
      setError(loadError.message || 'Unable to load appointments.')
      return false
    } finally {
      if (!quiet && requestId === requestSequence.current) setLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const payload = await api.getAppointmentStats()
      setStats({ ...initialStats, ...(payload.stats || {}) })
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchAppointments({ search: search.trim(), status, page, limit: PAGE_SIZE })
    }, search ? 300 : 0)
    return () => window.clearTimeout(timeout)
  }, [fetchAppointments, page, search, status])

  useEffect(() => {
    const timeout = window.setTimeout(() => fetchStats(), 0)
    return () => window.clearTimeout(timeout)
  }, [fetchStats])

  useEffect(() => {
    const modalOpen = Boolean(selectedAppointment || pendingAction)
    if (!modalOpen) return undefined

    function closeOnEscape(event) {
      if (event.key !== 'Escape' || workingId) return
      setSelectedAppointment(null)
      setPendingAction(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [pendingAction, selectedAppointment, workingId])

  const totalPages = Math.max(1, Math.ceil(Number(meta.total || 0) / PAGE_SIZE))
  const statusCounts = { ...initialStats.statusCounts, ...(stats.statusCounts || {}) }

  async function refreshAll() {
    setRefreshing(true)
    setError('')
    await Promise.all([
      fetchAppointments({ search: search.trim(), status, page, limit: PAGE_SIZE }, true),
      fetchStats(),
    ])
    setRefreshing(false)
  }

  async function updateStatus(appointment, nextStatus) {
    const id = getId(appointment)
    if (!id || isTerminal(appointment.status)) return

    if (nextStatus === 'Completed') {
      setPendingAction({ type: 'complete', appointment })
      return
    }

    await performStatusUpdate(appointment, nextStatus)
  }

  async function performStatusUpdate(appointment, nextStatus, cashPaymentReceived) {
    const id = getId(appointment)
    if (!id) return
    setWorkingId(`${id}-${nextStatus}`)
    setError('')

    try {
      const body = { status: nextStatus }
      if (typeof cashPaymentReceived === 'boolean') body.cashPaymentReceived = cashPaymentReceived
      await api.updateAppointment(id, body)
      setPendingAction(null)
      setSuccess(`${patientName(appointment)}’s appointment is now ${nextStatus.toLowerCase()}.`)
      await Promise.all([
        fetchAppointments({ search: search.trim(), status, page, limit: PAGE_SIZE }, true),
        fetchStats(),
      ])
    } catch (updateError) {
      setError(updateError.message || 'Unable to update the appointment status.')
      setPendingAction(null)
    } finally {
      setWorkingId('')
    }
  }

  async function rescheduleAppointment(appointment, date, time) {
    const id = getId(appointment)
    if (!id) return false
    setWorkingId(`${id}-reschedule`)
    setError('')

    try {
      await api.updateAppointment(id, { date, time: toTwelveHourTime(time) })
      setSelectedAppointment(null)
      setSuccess(`${patientName(appointment)}’s appointment was rescheduled successfully.`)
      await Promise.all([
        fetchAppointments({ search: search.trim(), status, page, limit: PAGE_SIZE }, true),
        fetchStats(),
      ])
      return { ok: true }
    } catch (rescheduleError) {
      return { ok: false, message: rescheduleError.message || 'Unable to reschedule the appointment.' }
    } finally {
      setWorkingId('')
    }
  }

  async function cancelAppointment(appointment) {
    const id = getId(appointment)
    if (!id) return
    setWorkingId(`${id}-cancel`)
    setError('')

    try {
      await api.cancelAppointment(id)
      setPendingAction(null)
      setSuccess(`${patientName(appointment)}’s appointment was canceled.`)
      await Promise.all([
        fetchAppointments({ search: search.trim(), status, page, limit: PAGE_SIZE }, true),
        fetchStats(),
      ])
    } catch (cancelError) {
      setError(cancelError.message || 'Unable to cancel the appointment.')
      setPendingAction(null)
    } finally {
      setWorkingId('')
    }
  }

  function chooseStatus(nextStatus) {
    setStatus(nextStatus)
    setPage(1)
  }

  function updateSearch(value) {
    setSearch(value)
    setPage(1)
  }

  function openCancelConfirmation(appointment) {
    setSelectedAppointment(null)
    setPendingAction({ type: 'cancel', appointment })
  }

  return (
    <main className="admin-page min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[90rem]">
        <header className="page-heading mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Booking management</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Appointments</h1>
            <p className="mt-2 text-sm text-slate-500">Manage doctor bookings, schedules, payments, and patient status.</p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="inline-flex h-11 self-start items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing' : 'Refresh data'}
          </button>
        </header>

        {error && <Alert tone="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert tone="success" onClose={() => setSuccess('')}>{success}</Alert>}

        <section aria-label="Appointment summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={CalendarDays} label="Total appointments" value={stats.total} detail={`${stats.recentLast7Days || 0} created in the last 7 days`} tone="sky" />
          <SummaryCard icon={Clock3} label="Pending" value={statusCounts.Pending} detail="Needs admin follow-up" tone="amber" />
          <SummaryCard icon={CheckCircle2} label="Completed" value={statusCounts.Completed} detail={`${statusCounts.Confirmed} currently confirmed`} tone="emerald" />
          <SummaryCard icon={WalletCards} label="Doctor-visit revenue" value={formatCurrency(stats.revenue)} detail="Completed visits marked paid" tone="violet" />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Doctor appointment queue</h2>
                <p className="mt-1 text-sm text-slate-500">{meta.total || 0} {Number(meta.total) === 1 ? 'booking matches' : 'bookings match'} this view</p>
              </div>
              <label className="relative block w-full lg:w-96">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <span className="sr-only">Search appointments</span>
                <input
                  value={search}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Search patient, phone, doctor"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => updateSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {STATUS_FILTERS.map((filter) => {
                const label = filter || 'All'
                const count = filter ? statusCounts[filter] || 0 : stats.total || 0
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => chooseStatus(filter)}
                    aria-pressed={status === filter}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                      status === filter
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                    }`}
                  >
                    {label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${status === filter ? 'bg-white/20' : 'bg-white'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(12rem,1.2fr)_minmax(11rem,1fr)_minmax(9rem,.85fr)_minmax(8rem,.75fr)_minmax(9rem,.8fr)_auto] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:grid">
            <span>Patient</span><span>Doctor</span><span>Schedule</span><span>Payment</span><span>Status</span><span className="text-right">Actions</span>
          </div>

          {loading ? (
            <AppointmentSkeleton />
          ) : appointments.length === 0 ? (
            <EmptyAppointments filtered={Boolean(search || status)} clearFilters={() => {
              updateSearch('')
              chooseStatus('')
            }} />
          ) : (
            <div className="divide-y divide-slate-100">
              {appointments.map((appointment) => (
                <AppointmentRow
                  key={getId(appointment)}
                  appointment={appointment}
                  workingId={workingId}
                  onStatusChange={(nextStatus) => updateStatus(appointment, nextStatus)}
                  onManage={() => setSelectedAppointment(appointment)}
                />
              ))}
            </div>
          )}

          {!loading && meta.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                  aria-label="Previous page"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="min-w-24 text-center text-xs font-bold text-slate-600">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages || loading}
                  aria-label="Next page"
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedAppointment && (
        <AppointmentModal
          key={getId(selectedAppointment)}
          appointment={selectedAppointment}
          busy={workingId === `${getId(selectedAppointment)}-reschedule`}
          onClose={() => setSelectedAppointment(null)}
          onReschedule={(date, time) => rescheduleAppointment(selectedAppointment, date, time)}
          onCancel={() => openCancelConfirmation(selectedAppointment)}
        />
      )}

      {pendingAction && (
        <ConfirmActionModal
          action={pendingAction}
          busy={Boolean(workingId)}
          onClose={() => !workingId && setPendingAction(null)}
          onConfirm={(cashPaymentReceived) => pendingAction.type === 'cancel'
            ? cancelAppointment(pendingAction.appointment)
            : performStatusUpdate(pendingAction.appointment, 'Completed', cashPaymentReceived)}
        />
      )}
    </main>
  )
}

function AppointmentRow({ appointment, workingId, onStatusChange, onManage }) {
  const id = getId(appointment)
  const terminal = isTerminal(appointment.status)
  const updating = workingId.startsWith(`${id}-`)

  return (
    <article className="grid gap-4 px-5 py-4 transition hover:bg-slate-50/70 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1.2fr)_minmax(11rem,1fr)_minmax(9rem,.85fr)_minmax(8rem,.75fr)_minmax(9rem,.8fr)_auto] xl:items-center">
      <div className="min-w-0">
        <MobileLabel>Patient</MobileLabel>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><UserRound size={18} /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{patientName(appointment)}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500"><Phone size={11} /> {appointment.mobile || 'No phone'}</p>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <MobileLabel>Doctor</MobileLabel>
        <p className="truncate text-sm font-bold text-slate-800">Dr. {doctorNameFromAppointment(appointment)}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{appointment.speciality || appointment.doctorId?.specialization || 'General medicine'}</p>
      </div>

      <div>
        <MobileLabel>Schedule</MobileLabel>
        <p className="text-sm font-semibold text-slate-700">{formatDate(appointment.date)}</p>
        <p className="mt-0.5 text-xs text-slate-500">{appointment.time || '-'}</p>
      </div>

      <div>
        <MobileLabel>Payment</MobileLabel>
        <PaymentBadge value={appointment.payment?.status || 'Pending'} />
        <p className="mt-1 text-xs font-bold text-slate-700">{formatCurrency(appointment.fees)}</p>
      </div>

      <div>
        <MobileLabel>Status</MobileLabel>
        {terminal ? (
          <StatusBadge value={appointment.status} />
        ) : (
          <span className="relative inline-block">
            {updating && <LoaderCircle className="absolute left-2 top-1/2 z-10 -translate-y-1/2 animate-spin text-slate-400" size={13} />}
            <select
              value={appointment.status}
              onChange={(event) => onStatusChange(event.target.value)}
              disabled={updating}
              aria-label={`Update status for ${patientName(appointment)}`}
              className={`h-9 rounded-xl border border-slate-200 bg-white pr-7 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 ${updating ? 'pl-7' : 'pl-2.5'}`}
            >
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Rescheduled">Rescheduled</option>
              <option value="Completed">Completed</option>
            </select>
          </span>
        )}
      </div>

      <div className="flex items-end justify-end sm:col-span-2 xl:col-span-1">
        <button
          type="button"
          onClick={onManage}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
        >
          <Eye size={14} /> Manage
        </button>
      </div>
    </article>
  )
}

function AppointmentModal({ appointment, busy, onClose, onReschedule, onCancel }) {
  const [rescheduling, setRescheduling] = useState(false)
  const [date, setDate] = useState(appointment.date || '')
  const [time, setTime] = useState(toTwentyFourHourTime(appointment.time))
  const [formError, setFormError] = useState('')
  const terminal = isTerminal(appointment.status)

  async function submitReschedule(event) {
    event.preventDefault()
    if (!date || !time) {
      setFormError('Choose both a new date and time.')
      return
    }
    setFormError('')
    const result = await onReschedule(date, time)
    if (!result?.ok) setFormError(result?.message || 'Unable to reschedule the appointment.')
  }

  return (
    <ModalShell onClose={onClose} titleId="appointment-details-title" closeDisabled={busy}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Appointment details</p>
          <h2 id="appointment-details-title" className="mt-1 text-xl font-bold text-slate-950">{patientName(appointment)}</h2>
          <p className="mt-1 text-sm text-slate-500">Booking #{shortId(appointment)}</p>
        </div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close appointment details" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={appointment.status} />
          <PaymentBadge value={appointment.payment?.status || 'Pending'} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Detail icon={UserRound} label="Patient" value={patientName(appointment)} detail={[appointment.age ? `${appointment.age} years` : '', appointment.gender].filter(Boolean).join(' · ') || 'Age and gender not provided'} />
          <Detail icon={Phone} label="Mobile" value={appointment.mobile || 'Not provided'} />
          <Detail icon={Stethoscope} label="Doctor" value={`Dr. ${doctorNameFromAppointment(appointment)}`} detail={appointment.speciality || appointment.doctorId?.specialization || 'General medicine'} />
          <Detail icon={CalendarDays} label="Schedule" value={formatDate(appointment.date)} detail={appointment.time || '-'} />
          <Detail icon={CreditCard} label="Payment" value={appointment.payment?.method || 'Cash'} detail={appointment.payment?.status || 'Pending'} />
          <Detail icon={WalletCards} label="Consultation fee" value={formatCurrency(appointment.fees)} />
        </div>

        {appointment.rescheduledTo?.date && (
          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            Rescheduled to {formatDate(appointment.rescheduledTo.date)} at {appointment.rescheduledTo.time || appointment.time}.
          </div>
        )}

        {!terminal && (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={() => setRescheduling((current) => !current)}
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:text-emerald-800"
            >
              <CalendarClock size={17} /> {rescheduling ? 'Hide reschedule form' : 'Reschedule appointment'}
            </button>

            {rescheduling && (
              <form onSubmit={submitReschedule} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-xs font-bold text-slate-600">New date</span>
                    <input
                      type="date"
                      value={date}
                      min={localDateKey(new Date())}
                      onChange={(event) => {
                        setDate(event.target.value)
                        setFormError('')
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold text-slate-600">New time</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => {
                        setTime(event.target.value)
                        setFormError('')
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                    />
                  </label>
                </div>
                {formError && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{formError}</p>}
                <div className="mt-4 flex justify-end">
                  <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
                    {busy ? <LoaderCircle className="animate-spin" size={16} /> : <CalendarClock size={16} />}
                    {busy ? 'Saving...' : 'Save new schedule'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
        {!terminal ? (
          <button type="button" onClick={onCancel} disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><XCircle size={16} /> Cancel appointment</button>
        ) : <span />}
        <button type="button" onClick={onClose} disabled={busy} autoFocus className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Close</button>
      </div>
    </ModalShell>
  )
}

function ConfirmActionModal({ action, busy, onClose, onConfirm }) {
  const canceling = action.type === 'cancel'
  const appointment = action.appointment
  const needsCashDecision = !canceling && requiresCashPaymentDecision(appointment)
  const [cashPaymentReceived, setCashPaymentReceived] = useState(null)
  return (
    <ModalShell onClose={onClose} titleId="confirm-action-title" closeDisabled={busy} size="max-w-md">
      <div className="p-6">
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${canceling ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
          {canceling ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
        </span>
        <h2 id="confirm-action-title" className="mt-4 text-lg font-bold text-slate-950">
          {canceling ? 'Cancel this appointment?' : 'Mark appointment completed?'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {canceling
            ? `${patientName(appointment)}’s booking will be canceled. A canceled appointment cannot be reopened from the admin console.`
            : `${patientName(appointment)}’s booking will be closed as completed. Only a completed, paid visit is added to doctor-visit revenue.`}
        </p>
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-bold text-slate-800">{formatDate(appointment.date)}</span> at {appointment.time} with Dr. {doctorNameFromAppointment(appointment)}
        </div>
        {needsCashDecision && (
          <fieldset className="mt-5">
            <legend className="text-sm font-bold text-slate-800">Was the consultation fee received in cash?</legend>
            <p className="mt-1 text-xs leading-5 text-slate-500">Choose one before completing the visit. Unpaid cash is excluded from revenue.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={cashPaymentReceived === true} onClick={() => setCashPaymentReceived(true)} disabled={busy} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${cashPaymentReceived === true ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'}`}>Yes, received</button>
              <button type="button" aria-pressed={cashPaymentReceived === false} onClick={() => setCashPaymentReceived(false)} disabled={busy} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${cashPaymentReceived === false ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-100' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'}`}>No, unpaid</button>
            </div>
          </fieldset>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} autoFocus className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Go back</button>
          <button
            type="button"
            onClick={() => onConfirm(cashPaymentReceived)}
            disabled={busy || (needsCashDecision && cashPaymentReceived === null)}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 ${canceling ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {busy && <LoaderCircle className="animate-spin" size={16} />}
            {busy ? 'Saving...' : canceling ? 'Cancel appointment' : 'Mark completed'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function ModalShell({ children, onClose, titleId, closeDisabled, size = 'max-w-2xl' }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 py-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Close dialog" onClick={onClose} disabled={closeDisabled} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm disabled:cursor-wait" />
      <section className={`relative w-full ${size} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}>{children}</section>
    </div>
  )
}

function SummaryCard({ icon: CardIcon, label, value, detail, tone }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-700 ring-sky-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
  }
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}><CardIcon size={20} /></span>
      </div>
    </article>
  )
}

function StatusBadge({ value }) {
  const classes = {
    Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    Confirmed: 'bg-sky-50 text-sky-700 ring-sky-200',
    Rescheduled: 'bg-violet-50 text-violet-700 ring-violet-200',
    Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Canceled: 'bg-rose-50 text-rose-700 ring-rose-200',
  }
  const status = value || 'Pending'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${classes[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{status}</span>
}

function PaymentBadge({ value }) {
  const classes = {
    Paid: 'bg-emerald-50 text-emerald-700',
    Pending: 'bg-amber-50 text-amber-700',
    Failed: 'bg-rose-50 text-rose-700',
    Refunded: 'bg-slate-100 text-slate-700',
  }
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${classes[value] || classes.Pending}`}>{value}</span>
}

function Detail({ icon: DetailIcon, label, value, detail }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-100"><DetailIcon size={16} /></span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{value}</p>
        {detail && <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  )
}

function MobileLabel({ children }) {
  return <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">{children}</p>
}

function Alert({ tone, onClose, children }) {
  const success = tone === 'success'
  return (
    <div role="alert" className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
      {success ? <CheckCircle2 size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
      <p className="flex-1">{children}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss message" className="grid h-7 w-7 place-items-center rounded-lg hover:bg-black/5"><X size={14} /></button>
    </div>
  )
}

function EmptyAppointments({ filtered, clearFilters }) {
  return (
    <div className="grid min-h-80 place-items-center px-5 py-12 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><CalendarDays size={24} /></span>
        <h3 className="mt-4 text-base font-bold text-slate-900">{filtered ? 'No matching appointments' : 'No appointments yet'}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{filtered ? 'Try another search or status filter.' : 'New doctor bookings will appear here automatically.'}</p>
        {filtered && <button type="button" onClick={clearFilters} className="mt-4 text-sm font-bold text-emerald-700 hover:text-emerald-800">Clear filters</button>}
      </div>
    </div>
  )
}

function AppointmentSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true">
      {[0, 1, 2, 3, 4].map((item) => <div key={item} className="mx-5 my-4 h-20 animate-pulse rounded-xl bg-slate-100" />)}
      <span className="sr-only">Loading appointments</span>
    </div>
  )
}

function patientName(appointment) {
  return appointment?.patientName || appointment?.patient?.name || 'Unknown patient'
}

function isTerminal(status) {
  return status === 'Completed' || status === 'Canceled'
}

function requiresCashPaymentDecision(appointment) {
  return appointment?.payment?.method === 'Cash'
    && appointment?.payment?.status !== 'Paid'
    && Number(appointment?.fees ?? appointment?.payment?.amount ?? 0) > 0
}

function shortId(appointment) {
  const id = String(getId(appointment) || 'pending')
  return id.slice(-8).toUpperCase()
}

function toTwelveHourTime(value) {
  const [rawHour, minute] = value.split(':')
  const hour = Number(rawHour)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const twelveHour = hour % 12 || 12
  return `${String(twelveHour).padStart(2, '0')}:${minute} ${suffix}`
}

function toTwentyFourHourTime(value = '') {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return /^\d{2}:\d{2}$/.test(value) ? value : ''
  const [, rawHour, minute, suffix] = match
  let hour = Number(rawHour) % 12
  if (suffix.toUpperCase() === 'PM') hour += 12
  return `${String(hour).padStart(2, '0')}:${minute}`
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
