import { useEffect, useState } from 'react'
import { BellRing, CheckCheck } from 'lucide-react'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, StatusBadge } from '../components/AdminUi'
import { api } from '../lib/api'

export default function MyAnnouncements() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    api.getMyAnnouncements().then((data) => { if (current) setItems(data) }).catch((loadError) => { if (current) setError(loadError.message) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [])

  async function markRead(item) {
    if (item.isRead) return
    try {
      await api.markAnnouncementRead(item._id)
      setItems((current) => current.map((value) => value._id === item._id ? { ...value, isRead: true } : value))
    } catch (updateError) { setError(updateError.message) }
  }

  return <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><PageHeader title="Announcements" subtitle="Hospital notices selected for your role, department, or account." /><ErrorMessage message={error} /><Panel>{loading ? <LoadingState /> : !items.length ? <EmptyState label="There are no announcements for you." /> : <div className="divide-y divide-slate-100">{items.map((item) => <article key={item._id} className={`p-5 sm:p-6 ${item.isRead ? '' : 'bg-emerald-50/40'}`}><div className="flex items-start gap-4"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.isRead ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}><BellRing size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-extrabold text-slate-900">{item.title}</h2><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()} · {item.createdByName || 'MediCare'}</p></div><StatusBadge value={item.priority} /></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.message}</p>{!item.isRead && <button type="button" onClick={() => markRead(item)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><CheckCheck size={15} /> Mark as read</button>}</div></div></article>)}</div>}</Panel></div></main>
}
