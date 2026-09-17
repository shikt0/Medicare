import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BadgeCheck, BriefcaseBusiness, CheckCircle2, ChevronRight, CircleOff, Clock3,
  Filter, HeartPulse, LoaderCircle, Mail, MapPin, Pencil, Phone, Plus, RefreshCw,
  Search, ShieldCheck, UserRound, UsersRound, X, XCircle,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, StatusBadge } from '../components/AdminUi'
import { api } from '../lib/api'
import { useStaffAuth } from '../auth/staffAuth'

const ROLE_TABS = [
  { value: '', label: 'All' },
  { value: 'nurse', label: 'Nurses' },
  { value: 'pathologist', label: 'Pathologists' },
  { value: 'hr', label: 'HR' },
  { value: 'freelancer', label: 'Freelancers' },
]
const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'freelance']
const STATUSES = ['active', 'on-leave', 'inactive']
const emptyStats = { total: 0, active: 0, onLeave: 0, inactive: 0, roles: {} }
const emptyForm = {
  employeeId: '', name: '', email: '', password: '', confirmPassword: '', phone: '', imageUrl: '', role: 'nurse',
  department: '', designation: '', qualification: '', joiningDate: '',
  employmentType: 'full-time', status: 'active', address: '',
  emergencyName: '', emergencyRelationship: '', emergencyPhone: '',
}

export default function StaffManagement() {
  const { actor } = useStaffAuth()
  const canManage = actor?.role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const role = searchParams.get('role') || ''
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [department, setDepartment] = useState(searchParams.get('department') || '')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [staff, setStaff] = useState([])
  const [departments, setDepartments] = useState([])
  const [stats, setStats] = useState(emptyStats)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState(null)
  const [selected, setSelected] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  const loadStaff = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [list, staffStats] = await Promise.all([
        api.getStaff({ q: query.trim(), role, department, status, limit: 200 }),
        api.getStaffStats(),
      ])
      setStaff(list.data || [])
      setDepartments(list.facets?.departments || [])
      setStats(staffStats || emptyStats)
      setSelected((current) => current
        ? (list.data || []).find((item) => item.id === current.id) || null
        : null)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load staff records.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [department, query, role, status])

  useEffect(() => {
    const timeout = window.setTimeout(() => loadStaff(), 250)
    return () => window.clearTimeout(timeout)
  }, [loadStaff])

  useEffect(() => {
    if (!editor && !selected && !statusTarget) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [editor, selected, statusTarget])

  function updateFilters(values) {
    const next = new URLSearchParams(searchParams)
    Object.entries(values).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    setSearchParams(next, { replace: true })
  }

  function chooseRole(nextRole) {
    updateFilters({ role: nextRole })
  }

  async function saveStaff(values) {
    const editing = Boolean(editor?.id)
    const payload = toPayload(values)
    const response = editing
      ? await api.updateStaff(editor.id, payload)
      : await api.createStaff(payload)
    setEditor(null)
    setNotice(response.message || (editing ? 'Staff profile updated.' : 'Staff member added.'))
    await loadStaff(true)
  }

  async function changeStatus() {
    if (!statusTarget) return
    const nextStatus = statusTarget.status === 'inactive' ? 'active' : 'inactive'
    try {
      const response = await api.updateStaffStatus(statusTarget.id, nextStatus)
      setNotice(response.message || 'Staff status updated.')
      setStatusTarget(null)
      setSelected(null)
      await loadStaff(true)
    } catch (updateError) {
      setError(updateError.message || 'Unable to update staff status.')
      setStatusTarget(null)
    }
  }

  const visibleMeta = useMemo(() => {
    const linked = staff.filter((item) => item.loginEnabled).length
    return `${staff.length} shown · ${linked} ready for portal login`
  }, [staff])

  return (
    <main className="admin-page min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="page-heading">
          <div>
            <p className="page-eyebrow">Workforce operations</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Staff Management</h1>
            <p className="mt-2 max-w-2xl text-sm">Manage nurses, pathologists, HR professionals and contract staff without exposing clinical records.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => loadStaff(true)} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
            {canManage && <button type="button" onClick={() => setEditor({})} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-800/15"><Plus size={17} /> Add staff</button>}
          </div>
        </header>

        {error && <Message tone="error" onClose={() => setError('')}>{error}</Message>}
        {notice && <Message tone="success" onClose={() => setNotice('')}>{notice}</Message>}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard icon={UsersRound} label="Total staff" value={stats.total} detail="All workforce records" tone="emerald" />
          <SummaryCard icon={BadgeCheck} label="Active" value={stats.active} detail="Currently available" tone="sky" />
          <SummaryCard icon={HeartPulse} label="Nurses" value={stats.roles?.nurse || 0} detail="Nursing team" tone="violet" />
          <SummaryCard icon={ShieldCheck} label="Pathologists" value={stats.roles?.pathologist || 0} detail="Laboratory team" tone="amber" />
          <SummaryCard icon={BriefcaseBusiness} label="Freelancers" value={stats.roles?.freelancer || 0} detail={`${stats.onLeave || 0} staff on leave`} tone="slate" />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 sm:p-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ROLE_TABS.map((tab) => <button key={tab.label} type="button" onClick={() => chooseRole(tab.value)} className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${role === tab.value ? 'bg-emerald-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`}>{tab.label}{tab.value && <span className="ml-1.5 opacity-70">{stats.roles?.[tab.value] || 0}</span>}</button>)}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_14rem_12rem]">
              <label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); updateFilters({ q: event.target.value }) }} placeholder="Search name, ID, email or department" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none" />{query && <button type="button" onClick={() => { setQuery(''); updateFilters({ q: '' }) }} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white"><X size={14} /></button>}</label>
              <label className="relative"><Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={department} onChange={(event) => { setDepartment(event.target.value); updateFilters({ department: event.target.value }) }} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none"><option value="">All departments</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <select value={status} onChange={(event) => { setStatus(event.target.value); updateFilters({ status: event.target.value }) }} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"><option value="">All statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</select>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-400">{visibleMeta}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Employment</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <StaffRowsSkeleton /> : staff.map((item) => <StaffRow key={item.id} staff={item} onView={() => setSelected(item)} />)}
              </tbody>
            </table>
          </div>
          {!loading && !staff.length && <EmptyState label="No staff records match these filters." />}
        </section>
      </div>

      {canManage && editor && <StaffEditor staff={editor.id ? editor : null} onClose={() => setEditor(null)} onSave={saveStaff} />}
      {selected && createPortal(<StaffProfile staff={selected} canManage={canManage} onClose={() => setSelected(null)} onEdit={() => { setEditor(selected); setSelected(null) }} onStatus={() => setStatusTarget(selected)} />, document.body)}
      {canManage && statusTarget && createPortal(<StatusConfirm staff={statusTarget} onClose={() => setStatusTarget(null)} onConfirm={changeStatus} />, document.body)}
    </main>
  )
}

function StaffRow({ staff, onView }) {
  return (
    <tr>
      <td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar staff={staff} /><div className="min-w-0"><p className="truncate font-bold text-slate-900">{staff.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{staff.employeeId} · {staff.email}</p></div></div></td>
      <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{labelize(staff.role)}</span></td>
      <td className="px-5 py-4 text-slate-600">{staff.department || 'Not assigned'}</td>
      <td className="px-5 py-4"><p className="font-semibold text-slate-700">{labelize(staff.employmentType)}</p><p className="mt-0.5 text-xs text-slate-400">{staff.designation || 'No designation'}</p></td>
      <td className="px-5 py-4"><StatusBadge value={staff.status} /></td>
      <td className="px-5 py-4 text-right"><button type="button" onClick={onView} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50">View <ChevronRight size={14} /></button></td>
    </tr>
  )
}

function StaffEditor({ staff, onClose, onSave }) {
  const [form, setForm] = useState(() => fromStaff(staff))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.employeeId.trim() || !form.name.trim() || !form.email.trim() || !form.role || (!staff && !form.password)) {
      setError('Employee ID, name, email, role and an initial password are required.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (form.password && form.password.length < 8) {
      setError('The portal password must contain at least 8 characters.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('The password confirmation does not match.')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
    } catch (saveError) {
      setError(saveError.message || 'Unable to save this staff member.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-5 lg:pl-[20rem]" role="dialog" aria-modal="true" aria-labelledby="staff-editor-title">
      <button type="button" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} aria-label="Close editor" />
      <form onSubmit={submit} className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700">Workforce record</p><h2 id="staff-editor-title" className="mt-1 text-xl font-extrabold text-slate-950">{staff ? 'Edit staff member' : 'Add staff member'}</h2></div><button type="button" onClick={onClose} disabled={saving} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"><X size={18} /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {error && <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700" role="alert">{error}</p>}
          <FormSection title="Identity and role"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Employee ID" name="employeeId" value={form.employeeId} onChange={update} required /><Field label="Full name" name="name" value={form.name} onChange={update} required /><Field label="Email address" name="email" type="email" value={form.email} onChange={update} required /><Field label="Phone" name="phone" value={form.phone} onChange={update} /><Select label="Role" name="role" value={form.role} onChange={update}>{ROLE_TABS.slice(1).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select><Field label="Profile image URL" name="imageUrl" value={form.imageUrl} onChange={update} /></div></FormSection>
          <FormSection title="Portal login credentials"><div className="grid gap-4 sm:grid-cols-2"><Field label={staff ? 'New password' : 'Initial password'} name="password" type="password" autoComplete="new-password" minLength="8" maxLength="72" value={form.password} onChange={update} required={!staff} placeholder={staff ? 'Leave blank to keep the current password' : 'At least 8 characters'} /><Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" minLength="8" maxLength="72" value={form.confirmPassword} onChange={update} required={!staff || Boolean(form.password)} placeholder="Enter the password again" /></div><p className="mt-3 text-xs leading-5 text-slate-500">Give these credentials only to this staff member. The password is securely hashed and cannot be viewed after saving.{staff && ' Enter a new password only when resetting access.'}</p></FormSection>
          <FormSection title="Employment details"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Department" name="department" value={form.department} onChange={update} /><Field label="Designation" name="designation" value={form.designation} onChange={update} /><Field label="Joining date" name="joiningDate" type="date" value={form.joiningDate} onChange={update} /><Select label="Employment type" name="employmentType" value={form.employmentType} onChange={update}>{EMPLOYMENT_TYPES.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</Select><Select label="Status" name="status" value={form.status} onChange={update}>{STATUSES.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}</Select><Field label="Qualification" name="qualification" value={form.qualification} onChange={update} /></div><label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Address</span><textarea name="address" value={form.address} onChange={update} rows="2" maxLength="500" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none" /></label></FormSection>
          <FormSection title="Emergency contact"><div className="grid gap-4 sm:grid-cols-3"><Field label="Contact name" name="emergencyName" value={form.emergencyName} onChange={update} /><Field label="Relationship" name="emergencyRelationship" value={form.emergencyRelationship} onChange={update} /><Field label="Phone" name="emergencyPhone" value={form.emergencyPhone} onChange={update} /></div></FormSection>
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6"><button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">Cancel</button><button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-60">{saving && <LoaderCircle size={16} className="animate-spin" />}{saving ? 'Saving...' : staff ? 'Save changes' : 'Add staff'}</button></footer>
      </form>
    </div>,
    document.body,
  )
}

function StaffProfile({ staff, canManage, onClose, onEdit, onStatus }) {
  return (
    <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="staff-profile-title"><button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={onClose} aria-label="Close profile" /><section className="relative flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl"><header className="flex items-center justify-between border-b border-slate-200 bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700">Staff profile</p><h2 id="staff-profile-title" className="mt-1 text-xl font-extrabold text-slate-950">{staff.name}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"><X size={18} /></button></header><div className="flex-1 overflow-y-auto p-5"><div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-4"><Avatar staff={staff} large /><div><p className="text-lg font-extrabold text-slate-950">{staff.name}</p><p className="mt-1 text-sm text-slate-500">{staff.designation || labelize(staff.role)}</p><div className="mt-2 flex flex-wrap gap-2"><StatusBadge value={staff.status} /><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${staff.accountLinked ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>{staff.accountLinked ? 'Login linked' : 'Awaiting login link'}</span></div></div></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Detail icon={UserRound} label="Employee ID" value={staff.employeeId} /><Detail icon={HeartPulse} label="Role" value={labelize(staff.role)} /><Detail icon={BriefcaseBusiness} label="Department" value={staff.department || 'Not assigned'} /><Detail icon={Clock3} label="Employment" value={labelize(staff.employmentType)} /><Detail icon={Mail} label="Email" value={staff.email} /><Detail icon={Phone} label="Phone" value={staff.phone || 'Not provided'} /><Detail icon={BadgeCheck} label="Qualification" value={staff.qualification || 'Not provided'} /><Detail icon={MapPin} label="Address" value={staff.address || 'Not provided'} /></div>{staff.emergencyContact && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Emergency contact</p><p className="mt-2 font-bold text-slate-800">{staff.emergencyContact.name || 'Not provided'}</p><p className="mt-1 text-sm text-slate-500">{[staff.emergencyContact.relationship, staff.emergencyContact.phone].filter(Boolean).join(' · ') || 'No contact details'}</p></div>}</div>{canManage && <footer className="flex gap-2 border-t border-slate-200 bg-white p-4"><button type="button" onClick={onEdit} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white"><Pencil size={16} /> Edit profile</button><button type="button" onClick={onStatus} className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-bold ${staff.status === 'inactive' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}><CircleOff size={16} />{staff.status === 'inactive' ? 'Reactivate' : 'Deactivate'}</button></footer>}</section></div>
  )
}

function StatusConfirm({ staff, onClose, onConfirm }) {
  const activate = staff.status === 'inactive'
  return <div className="fixed inset-0 z-[110] grid place-items-center px-4" role="dialog" aria-modal="true"><button type="button" className="absolute inset-0 bg-slate-950/50" onClick={onClose} aria-label="Close" /><section className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${activate ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}><CircleOff size={23} /></span><h2 className="mt-4 text-xl font-extrabold text-slate-950">{activate ? 'Reactivate' : 'Deactivate'} {staff.name}?</h2><p className="mt-2 text-sm leading-6 text-slate-500">{activate ? 'This restores access when the employee signs in with their linked account.' : 'The record and history are retained, but staff portal access is blocked.'}</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700">Cancel</button><button type="button" onClick={onConfirm} className={`h-10 rounded-xl px-4 text-sm font-bold text-white ${activate ? 'bg-emerald-700' : 'bg-rose-600'}`}>{activate ? 'Reactivate' : 'Deactivate'}</button></div></section></div>
}

function SummaryCard({ icon: Icon, label, value, detail, tone }) {
  const colors = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-700' }
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}><Icon size={19} /></span><p className="mt-4 text-xs font-bold uppercase tracking-[.1em] text-slate-400">{label}</p><strong className="mt-1 block text-2xl font-extrabold text-slate-950">{value || 0}</strong><small className="mt-1 block text-xs text-slate-500">{detail}</small></article>
}

function Message({ tone, onClose, children }) {
  const success = tone === 'success'
  return <div role={success ? 'status' : 'alert'} className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{success ? <CheckCircle2 size={18} /> : <XCircle size={18} />}<p className="flex-1">{children}</p><button type="button" onClick={onClose} aria-label="Dismiss"><X size={14} /></button></div>
}

function FormSection({ title, children }) {
  return <section className="mb-5 rounded-2xl border border-slate-200 p-4 last:mb-0"><h3 className="mb-4 text-sm font-extrabold text-slate-900">{title}</h3>{children}</section>
}

function Field({ label, required, ...props }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}{required && <i className="ml-1 not-italic text-rose-500">*</i>}</span><input {...props} required={required} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" /></label>
}

function Select({ label, children, ...props }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><select {...props} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">{children}</select></label>
}

function Detail({ icon: Icon, label, value }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={16} /></span><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{label}</p><strong className="mt-1 block break-words text-sm text-slate-800">{value}</strong></div></div>
}

function Avatar({ staff, large = false }) {
  const [failed, setFailed] = useState(false)
  const size = large ? 'h-20 w-20 rounded-2xl text-xl' : 'h-11 w-11 rounded-xl text-sm'
  if (!staff.imageUrl || failed) return <span className={`grid shrink-0 place-items-center bg-emerald-100 font-extrabold text-emerald-800 ${size}`}>{initials(staff.name)}</span>
  return <img src={staff.imageUrl} alt="" onError={() => setFailed(true)} className={`shrink-0 object-cover ${size}`} />
}

function StaffRowsSkeleton() {
  return <>{[0, 1, 2, 3, 4].map((item) => <tr key={item}><td colSpan="6" className="px-5 py-3"><div className="h-14 animate-pulse rounded-xl bg-slate-100" /></td></tr>)}</>
}

function fromStaff(staff) {
  if (!staff) return { ...emptyForm }
  return {
    ...emptyForm,
    ...staff,
    joiningDate: dateInput(staff.joiningDate),
    emergencyName: staff.emergencyContact?.name || '',
    emergencyRelationship: staff.emergencyContact?.relationship || '',
    emergencyPhone: staff.emergencyContact?.phone || '',
  }
}

function toPayload(form) {
  const payload = {
    employeeId: form.employeeId.trim(), name: form.name.trim(), email: form.email.trim(),
    phone: form.phone.trim(), imageUrl: form.imageUrl.trim(), role: form.role,
    department: form.department.trim(), designation: form.designation.trim(),
    qualification: form.qualification.trim(), joiningDate: form.joiningDate || null,
    employmentType: form.employmentType, status: form.status, address: form.address.trim(),
    emergencyContact: { name: form.emergencyName.trim(), relationship: form.emergencyRelationship.trim(), phone: form.emergencyPhone.trim() },
  }
  if (form.password) payload.password = form.password
  return payload
}

function dateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function labelize(value) {
  return String(value || '').split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

function initials(name = 'Staff') {
  return String(name).split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}
