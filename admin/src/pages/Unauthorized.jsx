import { ArrowLeft, RefreshCw, ShieldX } from 'lucide-react'
import { useStaffAuth } from '../auth/staffAuth'
import { Link } from 'react-router-dom'
import { ROLE_PORTAL_HOME } from '../auth/rolePortals'

export default function Unauthorized() {
  const { actor, logout, refreshActor, loading } = useStaffAuth()
  const portalHome = actor?.role === 'admin' ? '/' : ROLE_PORTAL_HOME[actor?.role]

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-600"><ShieldX size={30} /></span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Protected workspace</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Access not assigned</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          {actor?.staff?.status === 'inactive'
            ? 'Your staff record is inactive. Contact a MediCare administrator if this should be restored.'
            : actor?.role === 'patient'
            ? 'Your account is valid, but it is not linked to an active staff or administrator record.'
            : `Your ${actor?.role || 'current'} role cannot open this page.`}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" onClick={refreshActor} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-60"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Recheck access</button>
          <button type="button" onClick={logout} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700"><ArrowLeft size={16} /> Use another account</button>
        </div>
        <Link to={portalHome || '/login'} className="mt-6 inline-block text-sm font-bold text-emerald-700 hover:text-emerald-900">{portalHome ? 'Return to my workspace' : 'All login portals'}</Link>
      </section>
    </main>
  )
}
