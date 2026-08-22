import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  WalletCards,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatCurrency, getId } from '../lib/format'

const AVAILABILITY_FILTERS = ['All', 'Available', 'Unavailable']
const initialSummary = {
  totalAppointments: 0,
  pending: 0,
  confirmed: 0,
  rescheduled: 0,
  completed: 0,
  canceled: 0,
  earning: 0,
}

export default function ServiceDashboard() {
  const [definitions, setDefinitions] = useState([])
  const [serviceStats, setServiceStats] = useState([])
  const [serverSummary, setServerSummary] = useState(initialSummary)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState('All')
  const [sort, setSort] = useState('appointments')
  const [visibleCount, setVisibleCount] = useState(10)
  const [expandedId, setExpandedId] = useState('')

  const loadServices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    const results = await Promise.allSettled([
      api.getServices(),
      api.getServiceAppointmentStats(),
    ])
    const failed = []

    if (results[0].status === 'fulfilled') {
      setDefinitions(Array.isArray(results[0].value) ? results[0].value : [])
    } else failed.push('service profiles')

    if (results[1].status === 'fulfilled') {
      setServiceStats(Array.isArray(results[1].value.services) ? results[1].value.services : [])
      setServerSummary({ ...initialSummary, ...(results[1].value.summary || {}) })
    } else failed.push('booking statistics')

    if (results.some((result) => result.status === 'fulfilled')) setLastUpdated(new Date())
    if (failed.length) setError(`Some service data could not be loaded: ${failed.join(' and ')}.`)
    setLoading(false)
    setRefreshing(false)
    setVisibleCount(10)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => loadServices(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadServices])

  const services = useMemo(() => mergeServices(definitions, serviceStats), [definitions, serviceStats])
  const summary = useMemo(
    () => buildSummary(services, serverSummary, serviceStats.length > 0),
    [serverSummary, serviceStats.length, services],
  )

  const filteredServices = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const filtered = services.filter((service) => {
      const matchesAvailability = availability === 'All'
        || (availability === 'Available' ? isServiceAvailable(service) : !isServiceAvailable(service))
      const matchesQuery = !keyword || [service.name, service.shortDescription, service.about]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
      return matchesAvailability && matchesQuery
    })

    return [...filtered].sort((first, second) => {
      if (sort === 'revenue') return number(second.earning) - number(first.earning)
      if (sort === 'completion') return completionRate(second) - completionRate(first)
      if (sort === 'price') return number(second.price) - number(first.price)
      if (sort === 'name') return serviceName(first).localeCompare(serviceName(second))
      return number(second.totalAppointments) - number(first.totalAppointments)
    })
  }, [availability, query, services, sort])

  const visibleServices = filteredServices.slice(0, visibleCount)
  const topService = [...services].sort((first, second) => number(second.totalAppointments) - number(first.totalAppointments))[0]

  function updateQuery(value) {
    setQuery(value)
    setVisibleCount(10)
  }

  function updateAvailability(value) {
    setAvailability(value)
    setVisibleCount(10)
  }

  function updateSort(value) {
    setSort(value)
    setVisibleCount(10)
  }

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[90rem]">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Service analytics</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Service overview</h1>
            <p className="mt-2 text-sm text-slate-500">Track service availability, booking performance, completion, and revenue.</p>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <p className="hidden text-xs text-slate-400 md:block">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            )}
            <button
              type="button"
              onClick={() => loadServices(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
            <Link to="/add-service" className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
              <Plus size={17} /> Add service
            </Link>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => loadServices(true)} className="font-bold underline underline-offset-4">Try again</button>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss message" className="grid h-7 w-7 place-items-center rounded-lg hover:bg-black/5"><X size={14} /></button>
          </div>
        )}

        <section aria-label="Service summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Stethoscope} label="Services" value={services.length} detail={`${summary.availableServices} available to book`} tone="sky" />
          <SummaryCard icon={CalendarDays} label="Service bookings" value={summary.totalAppointments} detail={`${summary.pending} currently pending`} tone="violet" />
          <SummaryCard icon={CheckCircle2} label="Completed" value={summary.completed} detail={`${summary.completionRate}% completion rate`} tone="emerald" />
          <SummaryCard icon={WalletCards} label="Completed revenue" value={formatCurrency(summary.earning)} detail="Recorded fees from completed bookings" tone="amber" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,.75fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Booking status</h2>
                <p className="mt-1 text-sm text-slate-500">All service appointments grouped by their current state.</p>
              </div>
              <Activity className="text-emerald-600" size={21} />
            </div>
            <div className="mt-6 space-y-4">
              <StatusProgress label="Pending" value={summary.pending} total={summary.totalAppointments} color="bg-amber-500" />
              <StatusProgress label="Confirmed" value={summary.confirmed} total={summary.totalAppointments} color="bg-sky-500" />
              <StatusProgress label="Rescheduled" value={summary.rescheduled} total={summary.totalAppointments} color="bg-violet-500" />
              <StatusProgress label="Completed" value={summary.completed} total={summary.totalAppointments} color="bg-emerald-500" />
              <StatusProgress label="Canceled" value={summary.canceled} total={summary.totalAppointments} color="bg-rose-500" />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl bg-linear-to-br from-emerald-700 to-teal-600 p-6 text-white shadow-sm">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><Sparkles size={20} /></span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Top service</p>
            {topService ? (
              <>
                <h2 className="mt-2 truncate text-2xl font-bold">{serviceName(topService)}</h2>
                <p className="mt-2 text-sm text-emerald-50">{number(topService.totalAppointments)} bookings · {completionRate(topService)}% completed</p>
                <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
                  <div>
                    <p className="text-xs text-emerald-100">Completed revenue</p>
                    <p className="mt-1 text-xl font-bold">{formatCurrency(topService.earning)}</p>
                  </div>
                  <p className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">{formatCurrency(topService.price)}</p>
                </div>
              </>
            ) : (
              <div className="mt-5">
                <h2 className="text-xl font-bold">No services yet</h2>
                <p className="mt-2 text-sm text-emerald-50">Performance will appear after a service is added.</p>
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Service performance</h2>
                <p className="mt-1 text-sm text-slate-500">{filteredServices.length} {filteredServices.length === 1 ? 'service matches' : 'services match'} this view</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <span className="sr-only">Search services</span>
                  <input
                    value={query}
                    onChange={(event) => updateQuery(event.target.value)}
                    placeholder="Search services"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />
                  {query && (
                    <button type="button" onClick={() => updateQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"><X size={14} /></button>
                  )}
                </label>
                <label className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <span className="sr-only">Sort services</span>
                  <select
                    value={sort}
                    onChange={(event) => updateSort(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="appointments">Most bookings</option>
                    <option value="revenue">Highest revenue</option>
                    <option value="completion">Best completion rate</option>
                    <option value="price">Highest price</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {AVAILABILITY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => updateAvailability(filter)}
                  aria-pressed={availability === filter}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${availability === filter ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(14rem,1.25fr)_minmax(7rem,.55fr)_minmax(7rem,.6fr)_minmax(10rem,.9fr)_minmax(8rem,.7fr)_2.5rem] items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:grid">
            <span>Service</span><span>Price</span><span>Bookings</span><span>Completion</span><span>Revenue</span><span />
          </div>

          {loading ? (
            <ServiceSkeleton />
          ) : visibleServices.length === 0 ? (
            <EmptyServices filtered={Boolean(query || availability !== 'All')} clearFilters={() => {
              updateQuery('')
              updateAvailability('All')
            }} />
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleServices.map((service) => {
                const id = getId(service)
                return (
                  <ServiceRow
                    key={id || serviceName(service)}
                    service={service}
                    expanded={expandedId === id}
                    onToggle={() => setExpandedId((current) => current === id ? '' : id)}
                  />
                )
              })}
            </div>
          )}

          {!loading && visibleCount < filteredServices.length && (
            <div className="border-t border-slate-100 px-5 py-4 text-center">
              <button type="button" onClick={() => setVisibleCount((current) => current + 10)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700">
                Show more services ({filteredServices.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function ServiceRow({ service, expanded, onToggle }) {
  const rate = completionRate(service)
  const schedule = serviceSchedule(service)

  return (
    <article>
      <div className="grid gap-4 px-5 py-4 transition hover:bg-slate-50/70 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1.25fr)_minmax(7rem,.55fr)_minmax(7rem,.6fr)_minmax(10rem,.9fr)_minmax(8rem,.7fr)_2.5rem] xl:items-center">
        <div className="min-w-0">
          <MobileLabel>Service</MobileLabel>
          <div className="flex items-center gap-3">
            <ServiceImage service={service} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-slate-900">{serviceName(service)}</p>
                <AvailabilityBadge available={isServiceAvailable(service)} />
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-slate-500">{service.shortDescription || service.about || 'No description added'}</p>
            </div>
          </div>
        </div>

        <div>
          <MobileLabel>Price</MobileLabel>
          <p className="text-sm font-bold text-slate-800">{formatCurrency(service.price)}</p>
        </div>

        <div>
          <MobileLabel>Bookings</MobileLabel>
          <p className="text-sm font-bold text-slate-800">{number(service.totalAppointments)}</p>
          <p className="mt-0.5 text-xs text-slate-500">{number(service.pending)} pending</p>
        </div>

        <div>
          <MobileLabel>Completion</MobileLabel>
          <div className="flex items-center gap-3">
            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-700">{rate}%</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{number(service.completed)} completed · {number(service.canceled)} canceled</p>
        </div>

        <div>
          <MobileLabel>Revenue</MobileLabel>
          <p className="text-sm font-bold text-slate-900">{formatCurrency(service.earning)}</p>
        </div>

        <div className="flex justify-end sm:col-span-2 xl:col-span-1">
          <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'View'} details for ${serviceName(service)}`} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700">
            <ChevronDown size={17} className={`transition ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.8fr)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">About this service</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{service.about || service.shortDescription || 'No service description has been added.'}</p>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available schedule</p>
                  <span className="text-xs font-semibold text-slate-500">{schedule.totalSlots} slots</span>
                </div>
                {schedule.entries.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">No service slots configured.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {schedule.entries.slice(0, 4).map(([date, slots]) => (
                      <div key={date} className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                        <p className="text-xs font-bold text-slate-600">{formatServiceDate(date)}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {slots.map((slot) => <span key={slot} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{slot}</span>)}
                        </div>
                      </div>
                    ))}
                    {schedule.entries.length > 4 && <p className="text-xs font-semibold text-slate-400">+ {schedule.entries.length - 4} more available dates</p>}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patient instructions</p>
              {Array.isArray(service.instructions) && service.instructions.length ? (
                <ul className="mt-3 space-y-2">
                  {service.instructions.map((instruction, index) => (
                    <li key={`${instruction}-${index}`} className="flex gap-2 text-sm leading-5 text-slate-600">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={15} /> {instruction}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-500">No patient instructions added.</p>}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

function SummaryCard({ icon: CardIcon, label, value, detail, tone }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-700 ring-sky-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
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

function StatusProgress({ label, value, total, color }) {
  const percent = total ? Math.round((number(value) / number(total)) * 100) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-600">{label}</span>
        <span className="font-semibold text-slate-500">{value} · {percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

function ServiceImage({ service }) {
  const [failed, setFailed] = useState(false)
  const image = service.imageUrl || service.image || service.imageSmall
  if (image && !failed) return <img src={image} alt="" onError={() => setFailed(true)} className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100"><Stethoscope size={19} /></span>
}

function AvailabilityBadge({ available }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-400'}`} />{available ? 'Available' : 'Unavailable'}
    </span>
  )
}

function MobileLabel({ children }) {
  return <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 xl:hidden">{children}</p>
}

function EmptyServices({ filtered, clearFilters }) {
  return (
    <div className="grid min-h-80 place-items-center px-5 py-12 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Stethoscope size={24} /></span>
        <h3 className="mt-4 text-base font-bold text-slate-900">{filtered ? 'No matching services' : 'No services yet'}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{filtered ? 'Try another search or availability filter.' : 'Add the first service to begin tracking booking performance.'}</p>
        {filtered ? (
          <button type="button" onClick={clearFilters} className="mt-4 text-sm font-bold text-emerald-700 hover:text-emerald-800">Clear filters</button>
        ) : (
          <Link to="/add-service" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"><Plus size={16} /> Add service</Link>
        )}
      </div>
    </div>
  )
}

function ServiceSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true">
      {[0, 1, 2, 3, 4].map((item) => <div key={item} className="mx-5 my-4 h-20 animate-pulse rounded-xl bg-slate-100" />)}
      <span className="sr-only">Loading service performance</span>
    </div>
  )
}

function mergeServices(definitions, stats) {
  const records = new Map()
  definitions.forEach((service) => records.set(String(getId(service)), { ...service }))
  stats.forEach((service) => {
    const id = String(getId(service))
    const existing = records.get(id) || {}
    records.set(id, {
      ...existing,
      ...service,
      imageUrl: existing.imageUrl || service.image || null,
    })
  })
  return [...records.values()]
}

function buildSummary(services, serverSummary, hasServerStats) {
  const derived = services.reduce((total, service) => ({
    totalAppointments: total.totalAppointments + number(service.totalAppointments),
    pending: total.pending + number(service.pending),
    confirmed: total.confirmed + number(service.confirmed),
    rescheduled: total.rescheduled + number(service.rescheduled),
    completed: total.completed + number(service.completed),
    canceled: total.canceled + number(service.canceled),
    earning: total.earning + number(service.earning),
  }), { ...initialSummary })
  const base = hasServerStats ? { ...derived, ...serverSummary } : derived
  const totalAppointments = number(base.totalAppointments)
  return {
    ...base,
    availableServices: services.filter(isServiceAvailable).length,
    completionRate: totalAppointments ? Math.round((number(base.completed) / totalAppointments) * 100) : 0,
  }
}

function serviceName(service) {
  return service?.name || 'Unnamed service'
}

function isServiceAvailable(service) {
  const value = service?.available ?? service?.availability
  if (typeof value === 'boolean') return value
  return !['false', 'unavailable'].includes(String(value ?? 'true').toLowerCase())
}

function completionRate(service) {
  const total = number(service.totalAppointments)
  return total ? Math.round((number(service.completed) / total) * 100) : 0
}

function serviceSchedule(service) {
  const slots = service?.slots && typeof service.slots === 'object' ? service.slots : {}
  const entries = Object.entries(slots)
    .filter(([, values]) => Array.isArray(values) && values.length)
    .sort(([first], [second]) => first.localeCompare(second))
  return { entries, totalSlots: entries.reduce((total, [, values]) => total + values.length, 0) }
}

function formatServiceDate(value) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric' })
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
