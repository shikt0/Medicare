import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Stethoscope,
  Trash2,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatCurrency, getId } from '../lib/format'

const FILTERS = ['All', 'Available', 'Unavailable']
const WEEK_DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

export default function DoctorsList() {
  const [doctors, setDoctors] = useState([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState('All')
  const [sort, setSort] = useState('name')
  const [visibleCount, setVisibleCount] = useState(12)
  const [expandedId, setExpandedId] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const loadDoctors = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const payload = await api.getDoctorsPage({ limit: 500 })
      const records = payload.data || payload.doctors || []
      setDoctors(Array.isArray(records) ? records : [])
      setTotalRecords(Number(payload.meta?.total ?? records.length))
      setVisibleCount(12)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load doctors.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => loadDoctors(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadDoctors])

  useEffect(() => {
    if (!pendingDelete) return undefined

    function closeOnEscape(event) {
      if (event.key === 'Escape' && !deleting) setPendingDelete(null)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [deleting, pendingDelete])

  const summary = useMemo(() => ({
    available: doctors.filter(isAvailable).length,
    appointments: doctors.reduce((total, doctor) => total + metric(doctor, 'appointmentsTotal'), 0),
    completed: doctors.reduce((total, doctor) => total + metric(doctor, 'appointmentsCompleted'), 0),
    earnings: doctors.reduce((total, doctor) => total + finiteNumber(doctor.earnings), 0),
  }), [doctors])

  const filteredDoctors = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const records = doctors.filter((doctor) => {
      const matchesAvailability = availability === 'All'
        || (availability === 'Available' ? isAvailable(doctor) : !isAvailable(doctor))
      const matchesQuery = !keyword || [
        doctor.name,
        doctor.specialization,
        doctor.location,
        doctor.email,
        doctor.raw?.email,
        doctor.qualifications,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
      return matchesAvailability && matchesQuery
    })

    return [...records].sort((first, second) => {
      if (sort === 'appointments') return metric(second, 'appointmentsTotal') - metric(first, 'appointmentsTotal')
      if (sort === 'earnings') return finiteNumber(second.earnings) - finiteNumber(first.earnings)
      if (sort === 'rating') return finiteNumber(second.rating) - finiteNumber(first.rating)
      return doctorName(first).localeCompare(doctorName(second))
    })
  }, [availability, doctors, query, sort])

  const visibleDoctors = filteredDoctors.slice(0, visibleCount)

  function updateQuery(value) {
    setQuery(value)
    setVisibleCount(12)
  }

  function updateAvailability(value) {
    setAvailability(value)
    setVisibleCount(12)
  }

  function updateSort(value) {
    setSort(value)
    setVisibleCount(12)
  }

  function requestDelete(doctor) {
    setPendingDelete(doctor)
    setDeleteError('')
  }

  function closeDeleteModal() {
    if (deleting) return
    setPendingDelete(null)
    setDeleteError('')
  }

  async function confirmDelete() {
    const id = getId(pendingDelete)
    if (!id) return

    setDeleting(true)
    setDeleteError('')
    setError('')

    try {
      await api.deleteDoctor(id)
      const deletedName = doctorName(pendingDelete)
      setDoctors((current) => current.filter((doctor) => String(getId(doctor)) !== String(id)))
      setTotalRecords((current) => Math.max(0, current - 1))
      setExpandedId((current) => current === id ? '' : current)
      setPendingDelete(null)
      setSuccess(`${deletedName} was removed successfully.`)
    } catch (deleteFailure) {
      setDeleteError(deleteFailure.message || 'Unable to delete this doctor.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="admin-page min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="page-heading mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Provider management</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Doctors</h1>
            <p className="mt-2 text-sm text-slate-500">Review provider profiles, schedules, performance, and availability.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadDoctors(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
            <Link
              to="/add"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus size={17} /> Add doctor
            </Link>
          </div>
        </header>

        {error && (
          <Alert tone="error" onClose={() => setError('')}>
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => loadDoctors(true)} className="font-bold underline underline-offset-4">Try again</button>
          </Alert>
        )}
        {success && <Alert tone="success" onClose={() => setSuccess('')}>{success}</Alert>}

        <section aria-label="Doctor summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={UsersRound} label="Doctor records" value={totalRecords} detail={loadedDetail(doctors.length, totalRecords)} tone="sky" />
          <SummaryCard icon={UserRoundCheck} label="Available" value={summary.available} detail="Accepting appointments" tone="emerald" />
          <SummaryCard icon={CalendarDays} label="Appointments" value={summary.appointments} detail={`${summary.completed} confirmed or completed`} tone="violet" />
          <SummaryCard icon={CircleDollarSign} label="Provider earnings" value={formatCurrency(summary.earnings)} detail="Confirmed and completed visits" tone="amber" />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Provider directory</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredDoctors.length} {filteredDoctors.length === 1 ? 'doctor matches' : 'doctors match'} the current view
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <label className="relative min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <span className="sr-only">Search doctors</span>
                  <input
                    value={query}
                    onChange={(event) => updateQuery(event.target.value)}
                    placeholder="Search name, specialty, location"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => updateQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                <label className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <span className="sr-only">Sort doctors</span>
                  <select
                    value={sort}
                    onChange={(event) => updateSort(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="name">Name A–Z</option>
                    <option value="appointments">Most appointments</option>
                    <option value="earnings">Highest earnings</option>
                    <option value="rating">Highest rating</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => updateAvailability(filter)}
                  aria-pressed={availability === filter}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    availability === filter
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <DoctorGridSkeleton />
          ) : visibleDoctors.length === 0 ? (
            <EmptyDoctors filtered={Boolean(query || availability !== 'All')} clearFilters={() => {
              updateQuery('')
              updateAvailability('All')
            }} />
          ) : (
            <div className="grid gap-4 p-4 md:grid-cols-2 sm:p-5">
              {visibleDoctors.map((doctor) => {
                const id = getId(doctor)
                return (
                  <DoctorCard
                    key={id || doctorName(doctor)}
                    doctor={doctor}
                    expanded={expandedId === id}
                    onToggle={() => setExpandedId((current) => current === id ? '' : id)}
                    onDelete={() => requestDelete(doctor)}
                  />
                )
              })}
            </div>
          )}

          {!loading && visibleCount < filteredDoctors.length && (
            <div className="border-t border-slate-100 px-5 py-4 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + 12)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                Show more doctors ({filteredDoctors.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </section>
      </div>

      {pendingDelete && (
        <DeleteDoctorModal
          doctor={pendingDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={closeDeleteModal}
          onConfirm={confirmDelete}
        />
      )}
    </main>
  )
}

function DoctorCard({ doctor, expanded, onToggle, onDelete }) {
  const available = isAvailable(doctor)
  const schedule = scheduleEntries(doctor.schedule)

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white transition ${expanded ? 'border-emerald-200 shadow-md' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'}`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          <DoctorAvatar doctor={doctor} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-slate-950">{doctorName(doctor)}</h3>
                <p className="mt-0.5 truncate text-sm font-semibold text-emerald-700">{doctor.specialization || 'General medicine'}</p>
              </div>
              <AvailabilityBadge available={available} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-slate-500">
              <MapPin size={13} /> {doctor.location || 'Location not provided'}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3 text-center">
          <Metric label="Appointments" value={metric(doctor, 'appointmentsTotal')} />
          <Metric label="Completed" value={metric(doctor, 'appointmentsCompleted')} />
          <Metric label="Earnings" value={formatCompactCurrency(doctor.earnings)} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-bold text-amber-600"><Star size={14} fill="currentColor" /> {finiteNumber(doctor.rating).toFixed(1)}</span>
            <span className="truncate">{doctor.experience || 'Experience not provided'}</span>
          </div>
          <p className="shrink-0 text-sm font-bold text-slate-900">{formatCurrency(doctor.fee)}</p>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Detail label="Qualifications" value={doctor.qualifications || 'Not provided'} />
            <Detail label="Patients served" value={doctor.patients || 'Not provided'} />
            <Detail label="Success rate" value={doctor.success || 'Not provided'} />
            <Detail label="Email" value={doctor.email || doctor.raw?.email || 'Not provided'} />
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">About</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{doctor.about || 'No profile description has been added.'}</p>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly schedule</p>
              <span className="text-xs font-semibold text-slate-500">{schedule.reduce((total, [, slots]) => total + slots.length, 0)} recurring slots</span>
            </div>
            {schedule.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No appointment slots configured.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {schedule.slice(0, 4).map(([date, slots]) => (
                  <div key={date} className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <p className="text-xs font-bold text-slate-600">{formatScheduleDay(date)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map((slot) => (
                        <span key={slot} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{slot}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {schedule.length > 4 && <p className="text-xs font-semibold text-slate-400">+ {schedule.length - 4} more scheduled weekdays</p>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
        >
          {expanded ? 'Hide details' : 'View details'}
          <ChevronDown size={15} className={`transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </article>
  )
}

function DeleteDoctorModal({ doctor, deleting, error, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" role="dialog" aria-modal="true" aria-labelledby="delete-doctor-title">
      <button type="button" aria-label="Close delete confirmation" onClick={onCancel} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
            <Trash2 size={20} />
          </span>
          <div>
            <h2 id="delete-doctor-title" className="text-lg font-bold text-slate-950">Delete {doctorName(doctor)}?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This permanently removes the provider profile. Existing appointment records are not deleted, and this action cannot be undone.
            </p>
          </div>
        </div>

        {metric(doctor, 'appointmentsTotal') > 0 && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This doctor is linked to {metric(doctor, 'appointmentsTotal')} appointment {metric(doctor, 'appointmentsTotal') === 1 ? 'record' : 'records'}.
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            autoFocus
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Keep doctor
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon: CardIcon, label, value, detail, tone }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-700 ring-sky-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
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

function DoctorAvatar({ doctor }) {
  const [failed, setFailed] = useState(false)
  const image = doctor.imageUrl || doctor.image || doctor.avatar
  if (image && !failed) {
    return <img src={image} alt="" onError={() => setFailed(true)} className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200" />
  }
  return (
    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-xl font-bold text-emerald-700 ring-1 ring-emerald-100">
      {initials(doctorName(doctor))}
    </span>
  )
}

function AvailabilityBadge({ available }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-bold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {available ? 'Available' : 'Unavailable'}
    </span>
  )
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 px-2">
      <p className="truncate text-sm font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-700">{value}</p>
    </div>
  )
}

function Alert({ tone, onClose, children }) {
  const success = tone === 'success'
  return (
    <div role="alert" className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
      {success && <CheckCircle2 size={18} className="shrink-0" />}
      <div className="flex flex-1 items-center gap-3">{children}</div>
      <button type="button" onClick={onClose} aria-label="Dismiss message" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-black/5"><X size={14} /></button>
    </div>
  )
}

function EmptyDoctors({ filtered, clearFilters }) {
  return (
    <div className="grid min-h-80 place-items-center px-5 py-12 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Stethoscope size={24} /></span>
        <h3 className="mt-4 text-base font-bold text-slate-900">{filtered ? 'No matching doctors' : 'No doctors yet'}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          {filtered ? 'Try changing the search or availability filter.' : 'Add the first doctor to start building your provider directory.'}
        </p>
        {filtered ? (
          <button type="button" onClick={clearFilters} className="mt-4 text-sm font-bold text-emerald-700 hover:text-emerald-800">Clear filters</button>
        ) : (
          <Link to="/add" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Plus size={16} /> Add doctor</Link>
        )}
      </div>
    </div>
  )
}

function DoctorGridSkeleton() {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 sm:p-5" aria-busy="true">
      {[0, 1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}
      <span className="sr-only">Loading doctors</span>
    </div>
  )
}

function doctorName(doctor) {
  return doctor?.name || doctor?.fullName || 'Unnamed doctor'
}

function isAvailable(doctor) {
  const value = doctor?.availability ?? doctor?.available ?? doctor?.isAvailable
  if (typeof value === 'boolean') return value
  return String(value || 'Available').toLowerCase() === 'available'
}

function metric(doctor, field) {
  return finiteNumber(doctor?.[field] ?? doctor?.raw?.[field])
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCompactCurrency(value) {
  const number = finiteNumber(value)
  if (number < 1000) return formatCurrency(number)
  return `৳${new Intl.NumberFormat('en-BD', { notation: 'compact', maximumFractionDigits: 1 }).format(number)}`
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'D'
}

function scheduleEntries(schedule) {
  if (!schedule || typeof schedule !== 'object') return []
  return WEEK_DAYS
    .map((day) => [day.key, schedule[day.key] || []])
    .filter(([, slots]) => Array.isArray(slots) && slots.length)
}

function formatScheduleDay(value) {
  return WEEK_DAYS.find((day) => day.key === value)?.label || value
}

function loadedDetail(loaded, total) {
  return loaded < total ? `${loaded} profiles currently loaded` : 'All provider profiles loaded'
}
