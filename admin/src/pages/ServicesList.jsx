import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Stethoscope,
  Trash2,
  Upload,
  WalletCards,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatCurrency, getId } from '../lib/format'

const FILTERS = ['All', 'Available', 'Unavailable']
const PAGE_SIZE = 9

export default function ServicesList() {
  const [definitions, setDefinitions] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('newest')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expandedId, setExpandedId] = useState('')
  const [editingService, setEditingService] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
      setStats(Array.isArray(results[1].value.services) ? results[1].value.services : [])
    } else failed.push('booking totals')

    if (results.some((result) => result.status === 'fulfilled')) setLastUpdated(new Date())
    if (failed.length) setError(`Some data could not be loaded: ${failed.join(' and ')}.`)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => loadServices(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadServices])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (!editingService && !deleteTarget) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [deleteTarget, editingService])

  const services = useMemo(() => mergeServices(definitions, stats), [definitions, stats])

  const summary = useMemo(() => services.reduce((total, service) => ({
    available: total.available + (isAvailable(service) ? 1 : 0),
    bookings: total.bookings + asNumber(service.totalAppointments),
    completed: total.completed + asNumber(service.completed),
    revenue: total.revenue + asNumber(service.earning),
  }), { available: 0, bookings: 0, completed: 0, revenue: 0 }), [services])

  const filteredServices = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const result = services.filter((service) => {
      const matchesFilter = filter === 'All'
        || (filter === 'Available' ? isAvailable(service) : !isAvailable(service))
      const matchesSearch = !keyword || [service.name, service.shortDescription, service.about]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
      return matchesFilter && matchesSearch
    })

    return [...result].sort((first, second) => {
      if (sort === 'name') return serviceName(first).localeCompare(serviceName(second))
      if (sort === 'price') return asNumber(second.price) - asNumber(first.price)
      if (sort === 'bookings') return asNumber(second.totalAppointments) - asNumber(first.totalAppointments)
      if (sort === 'revenue') return asNumber(second.earning) - asNumber(first.earning)
      return new Date(second.createdAt || 0) - new Date(first.createdAt || 0)
    })
  }, [filter, query, services, sort])

  const visibleServices = filteredServices.slice(0, visibleCount)

  function resetView() {
    setQuery('')
    setFilter('All')
    setSort('newest')
    setVisibleCount(PAGE_SIZE)
  }

  async function saveService(formData) {
    const id = getId(editingService)
    if (!id) return { ok: false, message: 'This service cannot be updated because its profile is missing.' }
    setSaving(true)
    try {
      const response = await api.updateService(id, formData)
      const updated = response.data
      if (updated) {
        setDefinitions((current) => current.map((service) => getId(service) === id ? updated : service))
      }
      setEditingService(null)
      setNotice(`${serviceName(updated || editingService)} was updated successfully.`)
      setLastUpdated(new Date())
      return { ok: true }
    } catch (requestError) {
      return { ok: false, message: requestError.message || 'Could not update this service.' }
    } finally {
      setSaving(false)
    }
  }

  async function deleteService() {
    const id = getId(deleteTarget)
    if (!id) return
    setDeleting(true)
    try {
      const deletedName = serviceName(deleteTarget)
      await api.deleteService(id)
      setDefinitions((current) => current.filter((service) => getId(service) !== id))
      setStats((current) => current.filter((service) => getId(service) !== id))
      setExpandedId((current) => current === id ? '' : current)
      setDeleteTarget(null)
      setNotice(`${deletedName} was deleted.`)
      setLastUpdated(new Date())
    } catch (requestError) {
      setError(requestError.message || 'Could not delete this service.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="admin-page min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[90rem]">
        <header className="page-heading mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Service management</p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Services</h1>
            <p className="mt-2 text-sm text-slate-500">Manage the services patients can discover and book.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdated && (
              <p className="mr-1 hidden text-xs text-slate-400 lg:block">Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            )}
            <button
              type="button"
              onClick={() => loadServices(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <Link to="/add-service" className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
              <Plus size={17} /> Add service
            </Link>
          </div>
        </header>

        {notice && (
          <Message tone="success" onClose={() => setNotice('')}>{notice}</Message>
        )}
        {error && (
          <Message tone="error" onClose={() => setError('')}>
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => loadServices(true)} className="shrink-0 font-bold underline underline-offset-4">Try again</button>
          </Message>
        )}

        <section aria-label="Service totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={Stethoscope} label="Total services" value={services.length} detail={`${summary.available} currently available`} tone="sky" />
          <SummaryCard icon={CircleCheck} label="Available" value={summary.available} detail={`${services.length - summary.available} unavailable`} tone="emerald" />
          <SummaryCard icon={CalendarClock} label="Total bookings" value={summary.bookings} detail={`${summary.completed} completed`} tone="violet" />
          <SummaryCard icon={WalletCards} label="Completed revenue" value={formatCurrency(summary.revenue)} detail="From completed bookings" tone="amber" />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Service catalog</h2>
                <p className="mt-1 text-sm text-slate-500">{filteredServices.length} {filteredServices.length === 1 ? 'service matches' : 'services match'} this view</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <span className="sr-only">Search services</span>
                  <input
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE) }}
                    placeholder="Search services"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-50"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"><X size={14} /></button>
                  )}
                </label>
                <label className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <span className="sr-only">Sort services</span>
                  <select
                    value={sort}
                    onChange={(event) => { setSort(event.target.value); setVisibleCount(PAGE_SIZE) }}
                    className="h-11 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="newest">Newest first</option>
                    <option value="name">Name A-Z</option>
                    <option value="price">Highest price</option>
                    <option value="bookings">Most bookings</option>
                    <option value="revenue">Highest revenue</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setFilter(value); setVisibleCount(PAGE_SIZE) }}
                  aria-pressed={filter === value}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${filter === value ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <ServiceSkeleton />
            ) : visibleServices.length === 0 ? (
              <EmptyState filtered={Boolean(query || filter !== 'All')} onClear={resetView} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleServices.map((service) => {
                  const id = getId(service)
                  return (
                    <ServiceCard
                      key={id || serviceName(service)}
                      service={service}
                      expanded={expandedId === id}
                      onToggle={() => setExpandedId((current) => current === id ? '' : id)}
                      onEdit={() => setEditingService(service)}
                      onDelete={() => setDeleteTarget(service)}
                    />
                  )
                })}
              </div>
            )}

            {!loading && visibleCount < filteredServices.length && (
              <div className="pt-5 text-center">
                <button type="button" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700">
                  Show more ({filteredServices.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {editingService && (
        <EditServiceModal
          service={editingService}
          saving={saving}
          onClose={() => { if (!saving) setEditingService(null) }}
          onSave={saveService}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          service={deleteTarget}
          deleting={deleting}
          onClose={() => { if (!deleting) setDeleteTarget(null) }}
          onConfirm={deleteService}
        />
      )}
    </main>
  )
}

function ServiceCard({ service, expanded, onToggle, onEdit, onDelete }) {
  const schedule = serviceSchedule(service)
  const manageable = service._hasProfile !== false

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-emerald-200 hover:shadow-md">
      <div className="relative aspect-[16/7] overflow-hidden bg-slate-100">
        <ServiceImage service={service} />
        <div className="absolute left-3 top-3"><AvailabilityBadge available={isAvailable(service)} /></div>
        <div className="absolute bottom-3 right-3 rounded-xl bg-slate-950/80 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm">{formatCurrency(service.price)}</div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-slate-900">{serviceName(service)}</h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{service.shortDescription || service.about || 'No short description has been added.'}</p>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 px-2 py-3 text-center">
          <Metric label="Bookings" value={asNumber(service.totalAppointments)} />
          <Metric label="Completed" value={asNumber(service.completed)} />
          <Metric label="Revenue" value={formatCompactCurrency(service.earning)} />
        </div>

        {expanded && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">About</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">{service.about || 'No detailed description has been added.'}</p>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Schedule</p>
                <span className="text-xs font-semibold text-slate-500">{schedule.totalSlots} slots</span>
              </div>
              {schedule.entries.length ? (
                <div className="mt-2 space-y-2">
                  {schedule.entries.slice(0, 3).map(([date, slots]) => (
                    <div key={date} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                      <p className="text-xs font-bold text-slate-700">{formatDate(date)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{slots.join(', ')}</p>
                    </div>
                  ))}
                  {schedule.entries.length > 3 && <p className="text-xs font-semibold text-slate-400">+{schedule.entries.length - 3} more dates</p>}
                </div>
              ) : <p className="mt-2 text-sm text-slate-500">No booking slots configured.</p>}
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Patient instructions</p>
              {Array.isArray(service.instructions) && service.instructions.length ? (
                <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                  {service.instructions.map((instruction) => <li key={instruction} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{instruction}</li>)}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-500">No patient instructions added.</p>}
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
            <ChevronDown size={16} className={`transition ${expanded ? 'rotate-180' : ''}`} /> {expanded ? 'Hide details' : 'View details'}
          </button>
          <button type="button" onClick={onEdit} disabled={!manageable} aria-label={`Edit ${serviceName(service)}`} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"><Pencil size={16} /></button>
          <button type="button" onClick={onDelete} disabled={!manageable} aria-label={`Delete ${serviceName(service)}`} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={16} /></button>
        </div>
      </div>
    </article>
  )
}

function EditServiceModal({ service, saving, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service.name || '',
    shortDescription: service.shortDescription || '',
    about: service.about || '',
    price: service.price ?? '',
    availability: isAvailable(service) ? 'Available' : 'Unavailable',
    imageUrl: service.imageUrl || service.image || '',
  })
  const [instructions, setInstructions] = useState(() => makeInstructionRows(service.instructions))
  const [schedule, setSchedule] = useState(() => cleanSchedule(service.slots))
  const [slotDate, setSlotDate] = useState('')
  const [slotTime, setSlotTime] = useState('')
  const [image, setImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const fileInputRef = useRef(null)
  const objectUrlRef = useRef('')

  useEffect(() => () => revokePreviewUrl(objectUrlRef), [])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, saving])

  function changeField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  function selectImage(file) {
    const imageError = validateImage(file)
    if (imageError) {
      setImage(null)
      setErrors((current) => ({ ...current, image: imageError }))
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    revokePreviewUrl(objectUrlRef)
    const url = file ? URL.createObjectURL(file) : ''
    objectUrlRef.current = url
    setPreviewUrl(url)
    setImage(file || null)
    setErrors((current) => ({ ...current, image: '' }))
  }

  function changeInstruction(id, value) {
    setInstructions((current) => current.map((row) => row.id === id ? { ...row, text: value } : row))
  }

  function addInstruction() {
    if (instructions.length >= 10) return
    setInstructions((current) => [...current, { id: `${Date.now()}-${current.length}`, text: '' }])
  }

  function removeInstruction(id) {
    setInstructions((current) => {
      const next = current.filter((row) => row.id !== id)
      return next.length ? next : [{ id: `${Date.now()}-0`, text: '' }]
    })
  }

  function addSlot() {
    if (!slotDate || !slotTime) {
      setErrors((current) => ({ ...current, schedule: 'Choose both a date and a time.' }))
      return
    }
    const value = toTwelveHourTime(slotTime)
    if ((schedule[slotDate] || []).includes(value)) {
      setErrors((current) => ({ ...current, schedule: 'That time is already added for this date.' }))
      return
    }
    setSchedule((current) => ({
      ...current,
      [slotDate]: [...(current[slotDate] || []), value].sort(compareTimeSlots),
    }))
    setSlotTime('')
    setErrors((current) => ({ ...current, schedule: '' }))
  }

  function removeSlot(date, slot) {
    setSchedule((current) => {
      const remaining = current[date].filter((value) => value !== slot)
      const next = { ...current }
      if (remaining.length) next[date] = remaining
      else delete next[date]
      return next
    })
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateEditForm(form, image)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setSubmitError('Please correct the highlighted fields.')
      return
    }

    setErrors({})
    setSubmitError('')
    const formData = new FormData()
    formData.set('name', form.name.trim())
    formData.set('shortDescription', form.shortDescription.trim())
    formData.set('about', form.about.trim())
    formData.set('price', String(Number(form.price)))
    formData.set('availability', form.availability)
    formData.set('imageUrl', form.imageUrl.trim())
    formData.set('instructions', JSON.stringify([...new Set(instructions.map((row) => row.text.trim()).filter(Boolean))]))
    formData.set('slots', JSON.stringify(schedule))
    if (image) formData.set('image', image)

    const result = await onSave(formData)
    if (!result.ok) setSubmitError(result.message)
  }

  const displayedImage = previewUrl || form.imageUrl.trim() || service.imageUrl || service.image || ''

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="edit-service-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Edit service</p>
            <h2 id="edit-service-title" className="mt-1 text-xl font-bold text-slate-950">{serviceName(service)}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close edit service" className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {submitError && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{submitError}</div>}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,.65fr)]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="name" label="Service name" value={form.name} onChange={changeField} error={errors.name} required autoFocus />
                <Field name="price" label="Price" type="number" min="0" step="1" value={form.price} onChange={changeField} error={errors.price} prefix="৳" required />
              </div>
              <Field name="shortDescription" label="Short description" value={form.shortDescription} onChange={changeField} error={errors.shortDescription} maxLength={160} hint={`${form.shortDescription.length}/160`} />
              <TextArea name="about" label="About this service" value={form.about} onChange={changeField} rows={5} />
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Booking availability</span>
                <select name="availability" value={form.availability} onChange={changeField} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50">
                  <option>Available</option>
                  <option>Unavailable</option>
                </select>
              </label>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div><h3 className="text-sm font-bold text-slate-900">Patient instructions</h3><p className="mt-1 text-xs text-slate-500">Preparation notes shown before booking.</p></div>
                  <button type="button" onClick={addInstruction} disabled={instructions.length >= 10} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 disabled:opacity-40"><Plus size={14} /> Add</button>
                </div>
                <div className="mt-3 space-y-2">
                  {instructions.map((row, index) => (
                    <div key={row.id} className="flex gap-2">
                      <input value={row.text} onChange={(event) => changeInstruction(row.id, event.target.value)} placeholder={`Instruction ${index + 1}`} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
                      <button type="button" onClick={() => removeInstruction(row.id)} aria-label={`Remove instruction ${index + 1}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"><X size={15} /></button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-900">Service image</h3>
                <div className="mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50">
                  {displayedImage ? <PreviewImage key={displayedImage} src={displayedImage} /> : <div className="grid h-full place-items-center text-slate-400"><ImagePlus size={30} /></div>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => selectImage(event.target.files?.[0] || null)} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"><Upload size={16} /> Choose new image</button>
                {image && <p className="mt-2 truncate text-xs font-semibold text-emerald-700">{image.name}</p>}
                {errors.image && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.image}</p>}
                <Field className="mt-4" name="imageUrl" label="Or image URL" type="url" value={form.imageUrl} onChange={changeField} error={errors.imageUrl} placeholder="https://example.com/service.jpg" />
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700"><CalendarClock size={17} /></span>
                  <div><h3 className="text-sm font-bold text-slate-900">Booking schedule</h3><p className="mt-0.5 text-xs text-slate-500">Add or remove patient-facing time slots.</p></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <input type="date" min={todayKey()} value={slotDate} onChange={(event) => setSlotDate(event.target.value)} aria-label="Slot date" className="h-10 min-w-0 rounded-xl border border-slate-200 px-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
                  <input type="time" value={slotTime} onChange={(event) => setSlotTime(event.target.value)} aria-label="Slot time" className="h-10 min-w-0 rounded-xl border border-slate-200 px-2 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" />
                </div>
                <button type="button" onClick={addSlot} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"><Plus size={15} /> Add time slot</button>
                {errors.schedule && <p className="mt-2 text-xs font-semibold text-rose-600">{errors.schedule}</p>}
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {Object.entries(schedule).sort(([first], [second]) => first.localeCompare(second)).map(([date, slots]) => (
                    <div key={date} className="rounded-xl bg-slate-50 p-2.5">
                      <p className="text-xs font-bold text-slate-700">{formatDate(date)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {slots.map((slot) => (
                          <button key={slot} type="button" onClick={() => removeSlot(date, slot)} title="Remove this slot" className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:text-rose-600 hover:ring-rose-200">{slot}<X size={11} /></button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(schedule).length === 0 && <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No time slots added.</p>}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving} className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
            {saving ? <><LoaderCircle size={17} className="animate-spin" /> Saving</> : <><Save size={17} /> Save changes</>}
          </button>
        </div>
      </form>
    </div>
  )
}

function DeleteModal({ service, deleting, onClose, onConfirm }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !deleting) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [deleting, onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="delete-service-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle size={23} /></span>
        <h2 id="delete-service-title" className="mt-4 text-xl font-bold text-slate-950">Delete {serviceName(service)}?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">This permanently removes the service profile and it will no longer be bookable. Historical appointment records are retained.</p>
        {asNumber(service.totalAppointments) > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">This service has {asNumber(service.totalAppointments)} recorded bookings.</div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={deleting} autoFocus className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Keep service</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60">
            {deleting ? <><LoaderCircle size={16} className="animate-spin" /> Deleting</> : <><Trash2 size={16} /> Delete service</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    sky: 'bg-sky-50 text-sky-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p></div>
        <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}><Icon size={20} /></span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </article>
  )
}

function Metric({ label, value }) {
  return <div className="min-w-0 px-1"><p className="truncate text-sm font-bold text-slate-900">{value}</p><p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p></div>
}

function AvailabilityBadge({ available }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm ring-1 ${available ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}><span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-400'}`} />{available ? 'Available' : 'Unavailable'}</span>
}

function ServiceImage({ service }) {
  const source = service.imageUrl || service.image
  const [failedSource, setFailedSource] = useState('')
  if (!source || failedSource === source) return <div className="grid h-full w-full place-items-center bg-linear-to-br from-emerald-50 to-sky-50 text-emerald-300"><Stethoscope size={36} /></div>
  return <img src={source} alt="" onError={() => setFailedSource(source)} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
}

function PreviewImage({ src }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="grid h-full place-items-center text-slate-400"><ImagePlus size={30} /></div>
  return <img src={src} alt="Service preview" onError={() => setFailed(true)} className="h-full w-full object-cover" />
}

function Field({ label, error, hint, className = '', prefix, required, ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
        <span>{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>
        {hint && <span className="text-xs font-medium text-slate-400">{hint}</span>}
      </span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{prefix}</span>}
        <input {...props} required={required} aria-invalid={Boolean(error)} className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${prefix ? 'pl-8' : ''} ${error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-50' : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-50'}`} />
      </span>
      {error && <span className="mt-1.5 block text-xs font-semibold text-rose-600">{error}</span>}
    </label>
  )
}

function TextArea({ label, ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><textarea {...props} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" /></label>
}

function Message({ tone, onClose, children }) {
  const success = tone === 'success'
  return (
    <div role="alert" className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
      {success ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <button type="button" onClick={onClose} aria-label="Dismiss message" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-black/5"><X size={14} /></button>
    </div>
  )
}

function ServiceSkeleton() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="overflow-hidden rounded-2xl border border-slate-200"><div className="aspect-[16/7] animate-pulse bg-slate-100" /><div className="space-y-3 p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-10 animate-pulse rounded bg-slate-100" /><div className="h-16 animate-pulse rounded-xl bg-slate-100" /><div className="h-10 animate-pulse rounded-xl bg-slate-100" /></div></div>)}</div>
}

function EmptyState({ filtered, onClear }) {
  return (
    <div className="grid min-h-72 place-items-center px-5 py-12 text-center">
      <div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">{filtered ? <Search size={24} /> : <ClipboardList size={24} />}</span><h3 className="mt-4 text-lg font-bold text-slate-900">{filtered ? 'No matching services' : 'No services yet'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">{filtered ? 'Try a different search or availability filter.' : 'Create the first service to make it available for patients.'}</p>{filtered ? <button type="button" onClick={onClear} className="mt-4 text-sm font-bold text-emerald-700 hover:text-emerald-800">Clear filters</button> : <Link to="/add-service" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white"><Plus size={15} /> Add service</Link>}</div>
    </div>
  )
}

function mergeServices(definitions, stats) {
  const statistics = new Map(stats.map((service) => [getId(service), service]))
  const merged = definitions.map((service) => ({
    ...(statistics.get(getId(service)) || {}),
    ...service,
    _hasProfile: true,
  }))
  const known = new Set(definitions.map(getId))
  stats.forEach((service) => {
    if (!known.has(getId(service))) merged.push({ ...service, _hasProfile: false })
  })
  return merged
}

function serviceSchedule(service) {
  const entries = Object.entries(cleanSchedule(service.slots)).sort(([first], [second]) => first.localeCompare(second))
  return { entries, totalSlots: entries.reduce((total, [, slots]) => total + slots.length, 0) }
}

function cleanSchedule(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return {}
  return Object.fromEntries(Object.entries(slots)
    .filter(([date, values]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(values))
    .map(([date, values]) => [date, [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))].sort(compareTimeSlots)])
    .filter(([, values]) => values.length))
}

function makeInstructionRows(values) {
  const list = Array.isArray(values) ? values.map(String).filter(Boolean) : []
  return (list.length ? list : ['']).map((text, index) => ({ id: `instruction-${index}-${Date.now()}`, text }))
}

function validateEditForm(form, image) {
  const errors = {}
  if (form.name.trim().length < 2) errors.name = 'Enter a service name.'
  if (form.price === '' || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) errors.price = 'Price must be zero or greater.'
  if (form.imageUrl.trim() && !isHttpUrl(form.imageUrl.trim())) errors.imageUrl = 'Enter a valid http(s) image URL.'
  const imageError = validateImage(image)
  if (imageError) errors.image = imageError
  return errors
}

function validateImage(file) {
  if (!file) return ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a PNG, JPG, or WebP image.'
  if (file.size > 5 * 1024 * 1024) return 'Image size must be 5 MB or less.'
  return ''
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isAvailable(service) {
  if (typeof service.available === 'boolean') return service.available
  return String(service.availability || service.available || 'available').toLowerCase() !== 'unavailable'
}

function serviceName(service) {
  return service?.name || service?.serviceName || 'Untitled service'
}

function asNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCompactCurrency(value) {
  const amount = asNumber(value)
  if (amount < 1000) return `৳${amount.toLocaleString('en-BD')}`
  return `৳${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)}`
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-BD', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function todayKey() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toTwelveHourTime(value) {
  const [rawHour, minute] = value.split(':')
  const hour = Number(rawHour)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${suffix}`
}

function compareTimeSlots(first, second) {
  return timeSlotMinutes(first) - timeSlotMinutes(second)
}

function timeSlotMinutes(value) {
  const [time, suffix] = String(value).split(' ')
  const [rawHour, minute] = time.split(':').map(Number)
  if (!Number.isFinite(rawHour) || !Number.isFinite(minute)) return Number.MAX_SAFE_INTEGER
  return (rawHour % 12 + (suffix === 'PM' ? 12 : 0)) * 60 + minute
}

function revokePreviewUrl(ref) {
  if (!ref.current) return
  URL.revokeObjectURL(ref.current)
  ref.current = ''
}
