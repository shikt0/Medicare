import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, MapPin, UserRound } from 'lucide-react'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, StatusBadge } from '../components/AdminUi'
import { api } from '../lib/api'

export default function MySchedule() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('upcoming')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    let current = true
    api.getMyShifts().then((data) => { if (current) setItems(data) }).catch((loadError) => { if (current) setError(loadError.message) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const visible = useMemo(() => items.filter((item) => (tab === 'today' ? item.date === today : tab === 'previous' ? item.date < today : item.date >= today) && (!dateFilter || item.date === dateFilter)), [dateFilter, items, tab, today])

  return (
    <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
      <PageHeader title="My Duty Schedule" subtitle="Review today’s work, upcoming shifts, and previous assignments." />
      <ErrorMessage message={error} />
      <div className="mb-4 flex flex-wrap items-center gap-2">{['today', 'upcoming', 'previous'].map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${tab === item ? 'bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{item}</button>)}<label className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-500">Date <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" /></label>{dateFilter && <button type="button" onClick={() => setDateFilter('')} className="text-xs font-bold text-emerald-700">Clear date</button>}</div>
      <Panel>{loading ? <LoadingState /> : !visible.length ? <EmptyState label="No duties in this view." /> : <div className="grid gap-4 p-5 lg:grid-cols-2">{visible.map((shift) => <article key={shift._id} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{shift.department || 'General duty'}</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">{shift.ward || 'Hospital assignment'}</h2></div><StatusBadge value={shift.status} /></div><div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p className="flex items-center gap-2"><CalendarDays size={16} /> {shift.date}</p><p className="flex items-center gap-2"><Clock3 size={16} /> {shift.startTime}–{shift.endTime}</p>{shift.ward && <p className="flex items-center gap-2"><MapPin size={16} /> {shift.ward}</p>}<p className="flex items-center gap-2"><UserRound size={16} /> {shift.staffId?.designation || shift.role}</p></div>{shift.notes && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{shift.notes}</p>}{shift.appointmentIds?.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned patients</p><div className="mt-2 space-y-2">{shift.appointmentIds.map((appointment) => <div key={appointment._id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><strong>{appointment.patientName}</strong><span className="ml-2 text-slate-500">{appointment.time} · {appointment.status}</span></div>)}</div></div>}</article>)}</div>}</Panel>
    </div></main>
  )
}
