import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, FlaskConical, RefreshCw, Save, UserPlus, X } from 'lucide-react'
import { useStaffAuth } from '../auth/staffAuth'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, StatusBadge, SuccessMessage } from '../components/AdminUi'
import { api } from '../lib/api'

export default function Laboratory() {
  const { actor } = useStaffAuth()
  const isAdmin = actor?.role === 'admin'
  const [items, setItems] = useState([])
  const [pathologists, setPathologists] = useState([])
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const requests = [api.getLabTests({ status, limit: 200 })]
      if (isAdmin) requests.push(api.getStaff({ role: 'pathologist', status: 'active', limit: 200 }))
      const [orders, staffData] = await Promise.all(requests)
      setItems(orders.data || []); setPathologists(staffData?.data || [])
    } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
  }, [isAdmin, status])
  useEffect(() => { const timeout = window.setTimeout(load, 0); return () => window.clearTimeout(timeout) }, [load])

  const categories = useMemo(() => [...new Set(items.map((item) => item.testCategory).filter(Boolean))].sort(), [items])
  const visible = useMemo(() => items.filter((item) => {
    const text = query.trim().toLowerCase()
    const matchesText = !text || [item.testName, item.patientName, item.doctorName, item.sampleType].some((value) => String(value || '').toLowerCase().includes(text))
    return matchesText && (!category || item.testCategory === category)
  }), [category, items, query])

  async function assign(item, pathologistId) {
    if (!pathologistId) return
    try { const response = await api.assignLabTest(item._id, pathologistId); setNotice(response.message); await load() } catch (updateError) { setError(updateError.message) }
  }
  async function adminStatus(item, next) {
    try { const response = await api.updateLabStatus(item._id, next); setNotice(response.message); await load() } catch (updateError) { setError(updateError.message) }
  }

  return <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <PageHeader title={isAdmin ? 'Laboratory Operations' : 'Laboratory Queue'} subtitle={isAdmin ? 'Assign pathologists and monitor every order without editing clinical results.' : 'Process assigned tests and submit factual results. Diagnosis remains with the treating doctor.'} actions={<button type="button" onClick={load} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold"><RefreshCw size={16} /> Refresh</button>} />
    <ErrorMessage message={error} /><SuccessMessage message={notice} />
    <Panel className="mb-5 p-4"><div className="grid gap-3 md:grid-cols-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search test, patient, doctor, or sample" className="control" /><select value={status} onChange={(event) => setStatus(event.target.value)} className="control"><option value="">All statuses</option>{['ordered','sample-collected','processing','completed','cancelled'].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value)} className="control"><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></Panel>
    <Panel className="overflow-hidden">{loading ? <LoadingState /> : !visible.length ? <EmptyState label="No laboratory orders match this queue." /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr><th className="px-5 py-3">Test / patient</th><th className="px-5 py-3">Requested by</th><th className="px-5 py-3">Priority</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Pathologist</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((item) => <tr key={item._id}><td className="px-5 py-4"><strong className="block text-slate-900">{item.testName}</strong><span className="text-xs text-slate-500">{item.patientName} · {item.sampleType}</span></td><td className="px-5 py-4"><strong className="text-slate-700">Dr. {item.doctorName}</strong><p className="mt-1 text-xs text-slate-400">{new Date(item.orderedAt).toLocaleDateString()}</p></td><td className="px-5 py-4"><StatusBadge value={item.priority} /></td><td className="px-5 py-4"><StatusBadge value={item.status} /></td><td className="px-5 py-4">{isAdmin && !['completed','cancelled'].includes(item.status) ? <select value={item.assignedPathologist?._id || ''} onChange={(event) => assign(item, event.target.value)} className="h-9 max-w-48 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Unassigned</option>{pathologists.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select> : <span className="text-slate-600">{item.assignedPathologist?.name || 'Unassigned'}</span>}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => setSelected(item)} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Open</button>{isAdmin && !['completed','cancelled'].includes(item.status) && <button type="button" onClick={() => adminStatus(item, 'cancelled')} className="ml-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Cancel</button>}</td></tr>)}</tbody></table></div>}</Panel>
    {selected && <LabDetail item={selected} isAdmin={isAdmin} onClose={() => setSelected(null)} onSaved={async (message) => { setSelected(null); setNotice(message); await load() }} />}
  </div></main>
}

function LabDetail({ item, isAdmin, onClose, onSaved }) {
  const [result, setResult] = useState(item.result || '')
  const [resultNotes, setResultNotes] = useState(item.resultNotes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const next = { ordered: 'sample-collected', 'sample-collected': 'processing', processing: 'completed' }[item.status]
  async function saveResult() { setSaving(true); setError(''); try { const response = await api.submitLabResult(item._id, { result, resultNotes }); await onSaved(response.message) } catch (saveError) { setError(saveError.message) } finally { setSaving(false) } }
  async function advance() { setSaving(true); setError(''); try { if (next === 'completed' && result.trim() && result !== item.result) await api.submitLabResult(item._id, { result, resultNotes }); const response = await api.updateLabStatus(item._id, next); await onSaved(response.message) } catch (saveError) { setError(saveError.message) } finally { setSaving(false) } }
  return <div className="fixed inset-0 z-[100] flex justify-end"><button type="button" onClick={onClose} className="absolute inset-0 bg-slate-950/50" aria-label="Close" /><section className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Laboratory order</p><h2 className="mt-1 text-xl font-extrabold">{item.testName}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border"><X size={18} /></button></header><div className="flex-1 overflow-y-auto p-5"><div className="grid gap-3 sm:grid-cols-2">{[['Patient',item.patientName],['Doctor',`Dr. ${item.doctorName}`],['Sample',item.sampleType],['Category',item.testCategory || 'General']].map(([label,value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><strong className="mt-1 block text-sm text-slate-800">{value}</strong></div>)}</div>{item.clinicalNote && <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-bold uppercase text-amber-700">Clinical note</p><p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{item.clinicalNote}</p></div>}{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}{isAdmin ? <div className="mt-5 rounded-xl border border-slate-200 p-4"><p className="text-sm font-bold text-slate-700">Result</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.result || 'No result submitted yet.'}</p>{item.resultNotes && <p className="mt-3 text-sm text-slate-500">Notes: {item.resultNotes}</p>}</div> : <div className="mt-5 space-y-4"><label><span className="label">Test result</span><textarea value={result} onChange={(event) => setResult(event.target.value)} rows="7" maxLength="5000" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" placeholder="Enter observed result values and findings" /></label><label><span className="label">Result notes</span><textarea value={resultNotes} onChange={(event) => setResultNotes(event.target.value)} rows="3" maxLength="3000" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" /></label></div>}</div>{!isAdmin && !['completed','cancelled'].includes(item.status) && <footer className="flex flex-wrap justify-end gap-2 border-t bg-slate-50 p-4"><button type="button" onClick={saveResult} disabled={saving || !result.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold text-emerald-700 disabled:opacity-50"><Save size={15} /> Save result</button>{next && <button type="button" onClick={advance} disabled={saving || (next === 'completed' && !result.trim() && !item.result)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{next === 'completed' ? <CheckCircle2 size={16} /> : next === 'sample-collected' ? <UserPlus size={16} /> : <FlaskConical size={16} />} Mark {pretty(next)}</button>}</footer>}</section></div>
}

function pretty(value) { return String(value || '').split('-').map((part) => part && part[0].toUpperCase() + part.slice(1)).join(' ') }
