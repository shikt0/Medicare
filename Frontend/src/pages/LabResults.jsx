import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useClerk } from '@clerk/react'
import { CalendarDays, CheckCircle2, Download, FlaskConical, RefreshCw, ShieldCheck, Stethoscope } from 'lucide-react'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { EmptyState, ErrorState, LoadingPanel, PageIntro } from '../components/PatientUi'
import { patientApi } from '../lib/api'

export default function LabResults() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const clerk = useClerk()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (!isSignedIn) { setItems([]); setLoading(false); return }
    if (refresh) setRefreshing(true); else setLoading(true)
    setError('')
    try { setItems(await patientApi.getMyLabResults(await getToken())) } catch (loadError) { setError(loadError.message || 'Unable to load laboratory results.') } finally { setLoading(false); setRefreshing(false) }
  }, [getToken, isSignedIn])
  useEffect(() => { if (!isLoaded) return undefined; const timeout = window.setTimeout(() => load(), 0); return () => window.clearTimeout(timeout) }, [isLoaded, load])

  const latest = useMemo(() => [...items].sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)), [items])

  return <div className="patient-site"><Navbar /><main className="patient-page"><div className="patient-page__inner"><PageIntro kicker="Private health records" title="Laboratory results" description="View completed tests ordered by your MediCare doctor. Discuss interpretation and diagnosis with your treating clinician." actions={isSignedIn && <button type="button" onClick={() => load(true)} disabled={refreshing} className="patient-refresh-button"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>} />{!isLoaded || loading ? <LoadingPanel label="Loading laboratory results..." /> : !isSignedIn ? <section className="patient-auth-gate"><span><ShieldCheck size={27} /></span><p>Private patient area</p><h2>Sign in to see your laboratory results.</h2><small>Only results connected to your verified patient account are shown here.</small><button type="button" onClick={() => clerk.openSignIn()}>Sign in to continue</button></section> : <>{error && <ErrorState message={error} onRetry={() => load(true)} />}{!latest.length ? <EmptyState title="No completed results" message="Completed laboratory tests ordered by your doctor will appear here." actionLabel="View appointments" actionTo="/appointments" /> : <section className="grid gap-5 lg:grid-cols-2">{latest.map((item) => <article key={item._id} className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm"><header className="flex items-start gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white"><FlaskConical size={21} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Completed test</p><h2 className="mt-1 text-xl font-extrabold text-slate-950">{item.testName}</h2><p className="mt-1 text-sm text-slate-500">{item.testCategory || item.sampleType}</p></div><CheckCircle2 size={21} className="text-emerald-600" /></header><div className="p-5"><div className="grid gap-3 sm:grid-cols-2"><p className="flex items-center gap-2 text-sm text-slate-600"><Stethoscope size={16} className="text-emerald-700" /> Dr. {item.doctorName}</p><p className="flex items-center gap-2 text-sm text-slate-600"><CalendarDays size={16} className="text-emerald-700" /> {new Date(item.completedAt || item.updatedAt).toLocaleDateString()}</p></div><div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Result</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-800">{item.result}</p>{item.resultNotes && <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-500">{item.resultNotes}</p>}</div><button type="button" onClick={() => window.print()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-700"><Download size={15} /> Print result</button></div></article>)}</section>}</>}</div></main><Footer /></div>
}
