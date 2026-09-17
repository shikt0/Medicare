import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, StatusBadge, SuccessMessage } from '../components/AdminUi'
import { api } from '../lib/api'
import { useStaffAuth } from '../auth/staffAuth'

const initialForm = { staffId: '', date: '', startTime: '08:00', endTime: '16:00', department: '', ward: '', notes: '', status: 'scheduled', appointmentIds: [] }

export default function DutyManagement() {
  const { actor } = useStaffAuth()
  const isAdmin = actor?.role === 'admin'
  const [items, setItems] = useState([])
  const [staff, setStaff] = useState([])
  const [appointments, setAppointments] = useState([])
  const [filter, setFilter] = useState({ role: '', date: '', status: '' })
  const [editor, setEditor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const requests = [api.getShifts({ ...filter, limit: 200 }), api.getStaff({ status: 'active', limit: 200 })]
      if (isAdmin) requests.push(api.getAppointments({ limit: 200 }))
      const [shifts, staffData, appointmentData] = await Promise.all(requests)
      setItems(shifts.data || []); setStaff(staffData.data || []); setAppointments(appointmentData || [])
    } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
  }, [filter, isAdmin])
  useEffect(() => { const timeout = window.setTimeout(load, 150); return () => window.clearTimeout(timeout) }, [load])

  const summary = useMemo(() => ({ scheduled: items.filter((item) => item.status === 'scheduled').length, completed: items.filter((item) => item.status === 'completed').length }), [items])
  async function save(form) {
    try {
      const payload = { ...form }
      if (!isAdmin) delete payload.appointmentIds
      const response = form._id ? await api.updateShift(form._id, payload) : await api.createShift(payload)
      setNotice(response.message); setEditor(null); await load()
    } catch (saveError) { setError(saveError.message); throw saveError }
  }
  async function cancel(item) {
    if (!window.confirm(`Cancel ${item.staffId?.name || 'this staff member'}'s duty on ${item.date}?`)) return
    try { const response = await api.cancelShift(item._id); setNotice(response.message); await load() } catch (cancelError) { setError(cancelError.message) }
  }

  return <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <PageHeader title="Duty Management" subtitle={`${items.length} duties in view · ${summary.scheduled} scheduled · ${summary.completed} completed`} actions={<><button type="button" onClick={load} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold"><RefreshCw size={16} /> Refresh</button><button type="button" onClick={() => setEditor({ ...initialForm })} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"><CalendarPlus size={17} /> Assign duty</button></>} />
    <ErrorMessage message={error} /><SuccessMessage message={notice} />
    <Panel className="mb-5 p-4"><div className="grid gap-3 sm:grid-cols-3">{[['role','All roles',['','nurse','pathologist','hr','freelancer']],['status','All statuses',['','scheduled','completed','cancelled','on-leave']]].map(([key,label,options]) => <select key={key} value={filter[key]} onChange={(event) => setFilter((current) => ({ ...current, [key]: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"><option value="">{label}</option>{options.filter(Boolean).map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select>)}<input type="date" value={filter.date} onChange={(event) => setFilter((current) => ({ ...current, date: event.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></div></Panel>
    <Panel className="overflow-hidden">{loading ? <LoadingState /> : !items.length ? <EmptyState label="No duties match this view." /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr><th className="px-5 py-3">Staff</th><th className="px-5 py-3">Date & time</th><th className="px-5 py-3">Assignment</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={item._id}><td className="px-5 py-4"><strong className="block text-slate-900">{item.staffId?.name || 'Unknown staff'}</strong><span className="text-xs capitalize text-slate-500">{item.staffId?.employeeId} · {item.role}</span></td><td className="px-5 py-4"><strong className="text-slate-700">{item.date}</strong><p className="mt-1 text-xs text-slate-500">{item.startTime}–{item.endTime}</p></td><td className="px-5 py-4"><strong className="text-slate-700">{item.department || 'General'}</strong><p className="mt-1 text-xs text-slate-500">{item.ward || item.notes || 'No location note'}</p></td><td className="px-5 py-4"><StatusBadge value={item.status} /></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditor(toForm(item))} aria-label="Edit duty" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600"><Pencil size={15} /></button>{item.status !== 'cancelled' && <button type="button" onClick={() => cancel(item)} aria-label="Cancel duty" className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-600"><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div>}</Panel>
    {editor && <DutyEditor value={editor} staff={staff} appointments={appointments} canAttachAppointments={isAdmin} onClose={() => setEditor(null)} onSave={save} />}
  </div></main>
}

function DutyEditor({ value, staff, appointments, canAttachAppointments, onClose, onSave }) {
  const [form, setForm] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function update(event) { const { name, value: next, selectedOptions } = event.target; setForm((current) => ({ ...current, [name]: name === 'appointmentIds' ? Array.from(selectedOptions, (option) => option.value) : next })) }
  async function submit(event) { event.preventDefault(); setSaving(true); setError(''); try { await onSave(form) } catch (saveError) { setError(saveError.message) } finally { setSaving(false) } }
  return <div className="fixed inset-0 z-[100] grid place-items-center p-4"><button type="button" onClick={onClose} className="absolute inset-0 bg-slate-950/50" aria-label="Close" /><form onSubmit={submit} className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Duty schedule</p><h2 className="mt-1 text-xl font-extrabold">{form._id ? 'Edit duty' : 'Assign duty'}</h2></div><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border"><X size={17} /></button></header><div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 sm:grid-cols-2">{error && <p className="sm:col-span-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}<Field label="Staff member"><select name="staffId" value={form.staffId} onChange={update} required className="control"><option value="">Choose staff</option>{staff.map((item) => <option key={item.id} value={item.id}>{item.name} · {pretty(item.role)}</option>)}</select></Field><Field label="Date"><input name="date" type="date" value={form.date} onChange={update} required className="control" /></Field><Field label="Start time"><input name="startTime" type="time" value={form.startTime} onChange={update} required className="control" /></Field><Field label="End time"><input name="endTime" type="time" value={form.endTime} onChange={update} required className="control" /></Field><Field label="Department"><input name="department" value={form.department} onChange={update} className="control" /></Field><Field label="Ward / location"><input name="ward" value={form.ward} onChange={update} className="control" /></Field>{form._id && <Field label="Status"><select name="status" value={form.status} onChange={update} className="control">{['scheduled','completed','on-leave','cancelled'].map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></Field>}{canAttachAppointments && <label className="sm:col-span-2"><span className="label">Assigned patient appointments <small className="font-normal text-slate-400">(Ctrl/Cmd-click for multiple)</small></span><select multiple name="appointmentIds" value={form.appointmentIds || []} onChange={update} className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">{appointments.filter((item) => !['Completed','Canceled'].includes(item.status)).map((item) => <option key={item._id} value={item._id}>{item.patientName} · Dr. {item.doctorName} · {item.date} {item.time}</option>)}</select></label>}<label className="sm:col-span-2"><span className="label">Notes</span><textarea name="notes" rows="3" value={form.notes} onChange={update} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" /></label></div><footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4"><button type="button" onClick={onClose} className="h-10 rounded-xl border bg-white px-4 text-sm font-bold">Cancel</button><button disabled={saving} className="h-10 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save duty'}</button></footer></form></div>
}

function Field({ label, children }) { return <label><span className="label">{label}</span>{children}</label> }
function pretty(value) { return String(value || '').split('-').map((part) => part && part[0].toUpperCase() + part.slice(1)).join(' ') }
function toForm(item) { return { _id: item._id, staffId: item.staffId?._id || item.staffId, date: item.date, startTime: item.startTime, endTime: item.endTime, department: item.department || '', ward: item.ward || '', notes: item.notes || '', status: item.status, appointmentIds: (item.appointmentIds || []).map((appointment) => appointment._id || appointment) } }
