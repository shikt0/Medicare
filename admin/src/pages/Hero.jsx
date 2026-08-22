import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Stethoscope,
  UsersRound,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { api } from '../lib/api'
import {
  doctorNameFromAppointment,
  formatCurrency,
  formatDate,
  getId,
  serviceAppointmentTime,
  serviceNameFromAppointment,
} from '../lib/format'
import { StatusBadge } from '../components/AdminUi'

const STATUS_FILTERS = [
  { value: 'All', label: 'All activity' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Confirmed', label: 'Confirmed' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Canceled', label: 'Canceled' },
]

const initialDashboard = {
  doctors: [],
  services: [],
  appointments: [],
  serviceAppointments: [],
  appointmentMeta: {},
  serviceAppointmentMeta: {},
  appointmentStats: {},
  serviceStats: [],
}

export default function Hero() {
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [doctorSearch, setDoctorSearch] = useState('')
  const [doctorSort, setDoctorSort] = useState('appointments')
  const [showAllDoctors, setShowAllDoctors] = useState(false)
  const [activityFilter, setActivityFilter] = useState('All')

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    const sources = [
      ['doctors', 'doctors', api.getDoctors()],
      ['services', 'services', api.getServices()],
      ['appointments', 'doctor appointments', api.getAppointmentsPage({ limit: 200 })],
      ['serviceAppointments', 'service appointments', api.getServiceAppointmentsPage({ limit: 200 })],
      ['appointmentStats', 'appointment totals', api.getAppointmentStats()],
      ['serviceStats', 'service totals', api.getServiceAppointmentStats()],
    ]

    try {
      const results = await Promise.allSettled(sources.map(([, , promise]) => promise))
      const failedLabels = results
        .map((result, index) => result.status === 'rejected' ? sources[index][1] : null)
        .filter(Boolean)
      const successfulSources = results.length - failedLabels.length

      setDashboard((current) => {
        const next = { ...current }

        results.forEach((result, index) => {
          const [key] = sources[index]
          if (result.status === 'rejected') {
            return
          }

          const payload = result.value

          if (key === 'appointments') {
            next.appointments = payload.appointment || payload.appointments || []
            next.appointmentMeta = payload.meta || {}
          } else if (key === 'serviceAppointments') {
            next.serviceAppointments = payload.appointment || payload.appointments || payload.data || []
            next.serviceAppointmentMeta = payload.meta || {}
          } else if (key === 'appointmentStats') {
            next.appointmentStats = payload.stats || {}
          } else if (key === 'serviceStats') {
            next.serviceStats = payload.services || []
          } else {
            next[key] = Array.isArray(payload) ? payload : []
          }
        })

        return next
      })

      if (successfulSources > 0) setLastUpdated(new Date())
      if (failedLabels.length) {
        setError(`Some dashboard data could not be loaded: ${failedLabels.join(', ')}.`)
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => loadDashboard(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadDashboard])

  const summary = useMemo(() => buildSummary(dashboard), [dashboard])

  const doctors = useMemo(() => {
    const keyword = doctorSearch.trim().toLowerCase()
    const filtered = dashboard.doctors.filter((doctor) => {
      if (!keyword) return true
      return [doctor.name, doctor.specialization, doctor.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })

    return [...filtered].sort((first, second) => {
      if (doctorSort === 'name') return doctorName(first).localeCompare(doctorName(second))
      if (doctorSort === 'earnings') return doctorEarnings(second) - doctorEarnings(first)
      return doctorAppointmentCount(second) - doctorAppointmentCount(first)
    })
  }, [dashboard.doctors, doctorSearch, doctorSort])

  const displayedDoctors = showAllDoctors ? doctors : doctors.slice(0, 6)

  const recentActivity = useMemo(() => {
    if (activityFilter === 'All') return summary.allAppointments.slice(0, 8)
    return summary.allAppointments
      .filter((item) => normalizeStatus(item.status) === activityFilter)
      .slice(0, 8)
  }, [activityFilter, summary.allAppointments])

  if (loading) return <DashboardSkeleton />

  return (
    <main className="min-h-[calc(100vh-6rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Medicare admin</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-sm text-slate-500">A live view of providers, bookings, services, and revenue.</p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <p className="hidden text-xs text-slate-400 sm:block">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing' : 'Refresh data'}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              className="shrink-0 font-bold text-amber-950 underline decoration-amber-400 underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        <section aria-label="Dashboard summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={CalendarDays}
            label="Total bookings"
            value={summary.totalAppointments.toLocaleString()}
            detail={`${summary.todayAppointments} scheduled today`}
            color="emerald"
          />
          <SummaryCard
            icon={UsersRound}
            label="Doctors"
            value={dashboard.doctors.length.toLocaleString()}
            detail={`${summary.availableDoctors} currently available`}
            color="sky"
          />
          <SummaryCard
            icon={Activity}
            label="Services"
            value={dashboard.services.length.toLocaleString()}
            detail={`${summary.availableServices} available to book`}
            color="violet"
          />
          <SummaryCard
            icon={WalletCards}
            label="Revenue"
            value={formatCurrency(summary.revenue)}
            detail="Paid and completed bookings"
            color="amber"
          />
        </section>

        <section aria-label="Appointment status" className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatusSummary
            icon={Clock3}
            label="Pending"
            value={summary.statusCounts.Pending}
            active={activityFilter === 'Pending'}
            onClick={() => setActivityFilter(activityFilter === 'Pending' ? 'All' : 'Pending')}
            tone="amber"
          />
          <StatusSummary
            icon={CalendarDays}
            label="Confirmed"
            value={summary.statusCounts.Confirmed}
            active={activityFilter === 'Confirmed'}
            onClick={() => setActivityFilter(activityFilter === 'Confirmed' ? 'All' : 'Confirmed')}
            tone="sky"
          />
          <StatusSummary
            icon={CheckCircle2}
            label="Completed"
            value={summary.statusCounts.Completed}
            active={activityFilter === 'Completed'}
            onClick={() => setActivityFilter(activityFilter === 'Completed' ? 'All' : 'Completed')}
            tone="emerald"
          />
          <StatusSummary
            icon={XCircle}
            label="Canceled"
            value={summary.statusCounts.Canceled}
            active={activityFilter === 'Canceled'}
            onClick={() => setActivityFilter(activityFilter === 'Canceled' ? 'All' : 'Canceled')}
            tone="rose"
          />
        </section>

        <DoctorPerformance
          doctors={doctors}
          displayedDoctors={displayedDoctors}
          search={doctorSearch}
          setSearch={setDoctorSearch}
          sort={doctorSort}
          setSort={setDoctorSort}
          showAll={showAllDoctors}
          setShowAll={setShowAllDoctors}
        />

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,1fr)]">
          <RecentAppointments
            appointments={recentActivity}
            filter={activityFilter}
            setFilter={setActivityFilter}
          />
          <ServicePerformance services={summary.services} />
        </div>
      </div>
    </main>
  )
}

function DoctorPerformance({ doctors, displayedDoctors, search, setSearch, sort, setSort, showAll, setShowAll }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Doctor performance</h2>
          <p className="mt-1 text-sm text-slate-500">Booking volume and earnings by provider.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <span className="sr-only">Search doctors</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setShowAll(false)
              }}
              placeholder="Search doctors"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50 sm:w-64"
            />
          </label>
          <label>
            <span className="sr-only">Sort doctors</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 sm:w-auto"
            >
              <option value="appointments">Most appointments</option>
              <option value="earnings">Highest earnings</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
      </div>

      {displayedDoctors.length === 0 ? (
        <EmptySection
          icon={Stethoscope}
          title={search ? 'No matching doctors' : 'No doctors yet'}
          detail={search ? 'Try another name or specialization.' : 'Doctor records will appear here once added.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Doctor</th>
                <th className="px-5 py-3">Availability</th>
                <th className="px-5 py-3 text-center">Appointments</th>
                <th className="px-5 py-3 text-center">Completed</th>
                <th className="px-5 py-3 text-right">Earnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedDoctors.map((doctor) => {
                const available = isDoctorAvailable(doctor)
                return (
                  <tr key={getId(doctor) || doctorName(doctor)} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex min-w-56 items-center gap-3">
                        <DoctorAvatar doctor={doctor} />
                        <div>
                          <p className="font-bold text-slate-900">{doctorName(doctor)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{doctor.specialization || 'General medicine'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-slate-700">{doctorAppointmentCount(doctor)}</td>
                    <td className="px-5 py-4 text-center font-semibold text-emerald-700">{doctorCompletedCount(doctor)}</td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">{formatCurrency(doctorEarnings(doctor))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {doctors.length > 6 && (
        <div className="border-t border-slate-100 px-5 py-4 text-center">
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="text-sm font-bold text-emerald-700 hover:text-emerald-800"
          >
            {showAll ? 'Show fewer doctors' : `Show all ${doctors.length} doctors`}
          </button>
        </div>
      )}
    </section>
  )
}

function RecentAppointments({ appointments, filter, setFilter }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recent appointments</h2>
          <p className="mt-1 text-sm text-slate-500">Doctor and service activity in one queue.</p>
        </div>
        <label>
          <span className="sr-only">Filter appointments by status</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          >
            {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>

      {appointments.length === 0 ? (
        <EmptySection
          icon={CalendarDays}
          title={filter === 'All' ? 'No appointments yet' : `No ${filter.toLowerCase()} appointments`}
          detail="Appointment activity will appear here automatically."
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {appointments.map((appointment, index) => (
            <AppointmentRow key={`${appointment.kind}-${getId(appointment) || index}`} appointment={appointment} />
          ))}
        </div>
      )}
    </section>
  )
}

function ServicePerformance({ services }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-5">
        <h2 className="text-lg font-bold text-slate-900">Service performance</h2>
        <p className="mt-1 text-sm text-slate-500">Top services by appointment volume.</p>
      </div>

      {services.length === 0 ? (
        <EmptySection icon={Activity} title="No services yet" detail="Service records will appear here once added." />
      ) : (
        <div className="divide-y divide-slate-100 px-5">
          {services.slice(0, 6).map((service) => (
            <div key={getId(service) || service.name} className="flex items-center gap-3 py-4">
              <ServiceAvatar service={service} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-900">{service.name || 'Unnamed service'}</p>
                  <p className="shrink-0 text-sm font-bold text-slate-800">{service.totalAppointments || 0}</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{service.available === false ? 'Unavailable' : 'Available'}</span>
                  <span>{formatCurrency(service.earning || 0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function buildSummary(dashboard) {
  const doctorAppointments = dashboard.appointments.map((item) => ({ ...item, kind: 'Doctor' }))
  const serviceAppointments = dashboard.serviceAppointments.map((item) => ({ ...item, kind: 'Service' }))
  const allAppointments = [...doctorAppointments, ...serviceAppointments]
    .sort((first, second) => appointmentTimestamp(second) - appointmentTimestamp(first))

  const statusCounts = { Pending: 0, Confirmed: 0, Completed: 0, Canceled: 0 }
  allAppointments.forEach((item) => {
    const status = normalizeStatus(item.status)
    if (statusCounts[status] !== undefined) statusCounts[status] += 1
  })

  const doctorTotal = Number(dashboard.appointmentMeta.total ?? dashboard.appointmentStats.total ?? dashboard.appointments.length)
  const serviceTotal = Number(dashboard.serviceAppointmentMeta.total ?? dashboard.serviceAppointments.length)
  const doctorRevenue = finiteNumber(dashboard.appointmentStats.revenue)
  const serviceRevenue = dashboard.serviceStats.reduce((total, service) => total + finiteNumber(service.earning), 0)
  const fallbackDoctorRevenue = collectedRevenue(dashboard.appointments)
  const fallbackServiceRevenue = collectedRevenue(dashboard.serviceAppointments)
  const today = localDateKey(new Date())

  const services = dashboard.services
    .map((service) => {
      const stats = dashboard.serviceStats.find((item) => String(getId(item)) === String(getId(service)))
        || dashboard.serviceStats.find((item) => item.name === service.name)
      return { ...service, ...stats }
    })
    .sort((first, second) => finiteNumber(second.totalAppointments) - finiteNumber(first.totalAppointments))

  return {
    allAppointments,
    statusCounts,
    totalAppointments: doctorTotal + serviceTotal,
    todayAppointments: allAppointments.filter((item) => item.date === today).length,
    availableDoctors: dashboard.doctors.filter(isDoctorAvailable).length,
    availableServices: dashboard.services.filter((service) => service.available !== false).length,
    revenue: (doctorRevenue || fallbackDoctorRevenue) + (serviceRevenue || fallbackServiceRevenue),
    services,
  }
}

function SummaryCard({ icon: CardIcon, label, value, detail, color }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    sky: 'bg-sky-50 text-sky-700 ring-sky-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ${tones[color]}`}>
          <CardIcon size={20} />
        </span>
      </div>
    </article>
  )
}

function StatusSummary({ icon: StatusIcon, label, value, active, onClick, tone }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-emerald-400 ring-4 ring-emerald-50' : 'border-slate-200'}`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <StatusIcon size={19} />
      </span>
      <span>
        <span className="block text-xs font-semibold text-slate-500">{label}</span>
        <span className="mt-0.5 block text-xl font-bold text-slate-900">{value}</span>
      </span>
    </button>
  )
}

function AppointmentRow({ appointment }) {
  const isDoctor = appointment.kind === 'Doctor'
  const name = appointment.patientName || appointment.patient?.name || 'Unknown patient'
  const provider = isDoctor ? doctorNameFromAppointment(appointment) : serviceNameFromAppointment(appointment)
  const time = isDoctor ? appointment.time || '-' : serviceAppointmentTime(appointment)

  return (
    <article className="px-5 py-4 transition hover:bg-slate-50/80">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isDoctor ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}>
          {isDoctor ? <Stethoscope size={18} /> : <Activity size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="truncate text-sm font-bold text-slate-900">{name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{isDoctor ? 'Dr. ' : ''}{provider}</p>
            </div>
            <StatusBadge value={normalizeStatus(appointment.status)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{formatDate(appointment.date)}</span>
            <span>{time}</span>
            <span className="font-bold text-slate-700">{formatCurrency(appointmentFee(appointment))}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{appointment.kind}</span>
          </div>
        </div>
      </div>
    </article>
  )
}

function DoctorAvatar({ doctor }) {
  const image = doctor.imageUrl || doctor.image || doctor.avatar
  if (image) return <img src={image} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200" />
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
      <Stethoscope size={19} />
    </span>
  )
}

function ServiceAvatar({ service }) {
  const image = service.imageUrl || service.image || service.imageSmall
  if (image) return <img src={image} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200" />
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
      <Activity size={19} />
    </span>
  )
}

function EmptySection({ icon: EmptyIcon, title, detail }) {
  return (
    <div className="grid min-h-48 place-items-center px-5 py-10 text-center">
      <div>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <EmptyIcon size={20} />
        </span>
        <p className="mt-3 text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <main className="min-h-[calc(100vh-6rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8" aria-busy="true">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="mb-7 h-20 max-w-md rounded-2xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 rounded-2xl bg-white ring-1 ring-slate-200" />)}
        </div>
        <div className="mt-6 h-96 rounded-2xl bg-white ring-1 ring-slate-200" />
      </div>
      <span className="sr-only">Loading dashboard</span>
    </main>
  )
}

function normalizeStatus(status) {
  const value = String(status || 'Pending').toLowerCase()
  if (value === 'cancelled' || value === 'canceled') return 'Canceled'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function appointmentTimestamp(item) {
  const value = item.createdAt || `${item.date || ''} ${item.time || ''}`
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function appointmentFee(item) {
  return finiteNumber(item.fees ?? item.fee ?? item.amount ?? item.payment?.amount)
}

function collectedRevenue(appointments) {
  return appointments.reduce((total, item) => {
    const paid = item.payment?.status === 'Paid'
    const completedCash = item.payment?.method === 'Cash' && normalizeStatus(item.status) === 'Completed'
    return paid || completedCash ? total + appointmentFee(item) : total
  }, 0)
}

function doctorName(doctor) {
  return doctor.name || doctor.fullName || 'Unnamed doctor'
}

function doctorAppointmentCount(doctor) {
  return finiteNumber(doctor.appointmentsTotal ?? doctor.appointmentCount)
}

function doctorCompletedCount(doctor) {
  return finiteNumber(doctor.appointmentsCompleted ?? doctor.completedCount)
}

function doctorEarnings(doctor) {
  return finiteNumber(doctor.earnings)
}

function isDoctorAvailable(doctor) {
  const value = doctor.availability ?? doctor.available ?? doctor.isAvailable
  if (typeof value === 'boolean') return value
  return String(value || 'Available').toLowerCase() === 'available'
}
