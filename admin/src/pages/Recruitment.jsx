import { useCallback, useEffect, useState } from 'react'
import { BriefcaseBusiness, ExternalLink, Pencil, Plus, RefreshCw, X } from 'lucide-react'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, StatusBadge, SuccessMessage } from '../components/AdminUi'
import { api } from '../lib/api'

const blankJob = { title: '', department: '', role: 'nurse', employmentType: 'full-time', description: '', requirements: '', qualification: '', numberOfPositions: 1, deadline: '' }
const applicantStatuses = ['applied', 'reviewing', 'shortlisted', 'rejected', 'hired']

export default function Recruitment() {
  const [tab, setTab] = useState('jobs')
  const [jobs, setJobs] = useState([])
  const [applicants, setApplicants] = useState([])
  const [editor, setEditor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const [jobData, applicantData] = await Promise.all([api.getManagedJobs(), api.getApplicants({ limit: 200 })]); setJobs(jobData); setApplicants(applicantData.data || []) } catch (loadError) { setError(loadError.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { const timeout = window.setTimeout(load, 0); return () => window.clearTimeout(timeout) }, [load])

  async function saveJob(form) {
    try { const response = form._id ? await api.updateJob(form._id, form) : await api.createJob(form); setEditor(null); setNotice(response.message); await load() } catch (saveError) { setError(saveError.message); throw saveError }
  }
  async function toggleJob(job) {
    try { const response = await api.updateJobStatus(job._id, job.status === 'open' ? 'closed' : 'open'); setNotice(response.message); await load() } catch (updateError) { setError(updateError.message) }
  }
  async function applicantStatus(id, status) {
    try { const response = await api.updateApplicantStatus(id, status); setNotice(response.message); await load() } catch (updateError) { setError(updateError.message) }
  }

  return <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <PageHeader title="Recruitment" subtitle="Publish hospital roles and move applicants through a consistent hiring workflow." actions={<><button type="button" onClick={load} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold"><RefreshCw size={16} /> Refresh</button><button type="button" onClick={() => setEditor({ ...blankJob })} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white"><Plus size={16} /> New opening</button></>} />
    <ErrorMessage message={error} /><SuccessMessage message={notice} />
    <div className="mb-4 flex gap-2"><button type="button" onClick={() => setTab('jobs')} className={tabClass(tab === 'jobs')}>Openings ({jobs.length})</button><button type="button" onClick={() => setTab('applicants')} className={tabClass(tab === 'applicants')}>Applicants ({applicants.length})</button></div>
    {tab === 'jobs' ? <JobsPanel jobs={jobs} loading={loading} onEdit={(job) => setEditor(toForm(job))} onToggle={toggleJob} /> : <ApplicantsPanel applicants={applicants} loading={loading} onStatus={applicantStatus} />}
    {editor && <JobEditor value={editor} onClose={() => setEditor(null)} onSave={saveJob} />}
  </div></main>
}

function JobsPanel({ jobs, loading, onEdit, onToggle }) {
  return <Panel>{loading ? <LoadingState /> : !jobs.length ? <EmptyState label="No job openings have been created." /> : <div className="grid gap-4 p-5 lg:grid-cols-2">{jobs.map((job) => <article key={job._id} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><BriefcaseBusiness size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-extrabold text-slate-900">{job.title}</h2><p className="mt-1 text-xs capitalize text-slate-500">{job.department} · {pretty(job.role)} · {pretty(job.employmentType)}</p></div><StatusBadge value={job.status} /></div><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{job.description}</p><p className="mt-3 text-xs font-semibold text-slate-400">{job.numberOfPositions} position(s) · Deadline {new Date(job.deadline).toLocaleDateString()}</p><div className="mt-4 flex gap-2"><button type="button" onClick={() => onEdit(job)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold"><Pencil size={14} /> Edit</button><button type="button" onClick={() => onToggle(job)} className={`rounded-lg px-3 py-2 text-xs font-bold ${job.status === 'open' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{job.status === 'open' ? 'Close opening' : 'Reopen'}</button></div></div></div></article>)}</div>}</Panel>
}

function ApplicantsPanel({ applicants, loading, onStatus }) {
  return <Panel className="overflow-hidden">{loading ? <LoadingState /> : !applicants.length ? <EmptyState label="No applications have been submitted." /> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr><th className="px-5 py-3">Applicant</th><th className="px-5 py-3">Opening</th><th className="px-5 py-3">Application</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{applicants.map((item) => <tr key={item._id}><td className="px-5 py-4"><strong className="block text-slate-900">{item.name}</strong><span className="text-xs text-slate-500">{item.email} · {item.phone}</span></td><td className="px-5 py-4"><strong className="text-slate-700">{item.jobId?.title || 'Deleted opening'}</strong><p className="mt-1 text-xs text-slate-400">{item.jobId?.department}</p></td><td className="px-5 py-4"><a href={item.cvUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">View CV <ExternalLink size={13} /></a><p className="mt-1 text-xs text-slate-400">{new Date(item.appliedAt).toLocaleDateString()}</p></td><td className="px-5 py-4"><select value={item.status} onChange={(event) => onStatus(item._id, event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold">{applicantStatuses.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></td></tr>)}</tbody></table></div>}</Panel>
}

function JobEditor({ value, onClose, onSave }) {
  const [form, setForm] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function update(event) { const { name, value: next } = event.target; setForm((current) => ({ ...current, [name]: next })) }
  async function submit(event) { event.preventDefault(); setSaving(true); setError(''); try { await onSave(form) } catch (saveError) { setError(saveError.message) } finally { setSaving(false) } }
  return <div className="fixed inset-0 z-[100] grid place-items-center p-4"><button type="button" onClick={onClose} className="absolute inset-0 bg-slate-950/50" aria-label="Close" /><form onSubmit={submit} className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Recruitment opening</p><h2 className="mt-1 text-xl font-extrabold">{form._id ? 'Edit opening' : 'New opening'}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border"><X size={18} /></button></header><div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">{error && <p className="sm:col-span-2 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}<Input label="Title" name="title" value={form.title} onChange={update} required /><Input label="Department" name="department" value={form.department} onChange={update} required /><Select label="Role" name="role" value={form.role} onChange={update} options={['nurse','pathologist','hr','freelancer','other']} /><Select label="Employment type" name="employmentType" value={form.employmentType} onChange={update} options={['full-time','part-time','contract','freelance']} /><Input label="Positions" name="numberOfPositions" type="number" min="1" value={form.numberOfPositions} onChange={update} required /><Input label="Deadline" name="deadline" type="date" value={form.deadline} onChange={update} required />{[['Description','description',5],['Requirements','requirements',3],['Qualification','qualification',2]].map(([label,name,rows]) => <label key={name} className="sm:col-span-2"><span className="label">{label}</span><textarea name={name} value={form[name]} onChange={update} rows={rows} required={name === 'description'} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" /></label>)}</div><footer className="flex justify-end gap-2 border-t bg-slate-50 p-4"><button type="button" onClick={onClose} className="h-10 rounded-xl border bg-white px-4 text-sm font-bold">Cancel</button><button disabled={saving} className="h-10 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save opening'}</button></footer></form></div>
}

function Input({ label, ...props }) { return <label><span className="label">{label}</span><input {...props} className="control" /></label> }
function Select({ label, options, ...props }) { return <label><span className="label">{label}</span><select {...props} className="control">{options.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label> }
function tabClass(active) { return `rounded-xl px-4 py-2 text-sm font-bold ${active ? 'bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-600'}` }
function pretty(value) { return String(value || '').split('-').map((part) => part && part[0].toUpperCase() + part.slice(1)).join(' ') }
function toForm(job) { return { ...job, deadline: job.deadline ? new Date(job.deadline).toISOString().slice(0, 10) : '' } }
