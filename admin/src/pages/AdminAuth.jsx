import { SignIn } from '@clerk/react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/staffAuth'
import { ErrorMessage, LoadingState } from '../components/AdminUi'
import logo from '../assets/logo.png'

export default function AdminAuth() {
  const { actor, error, isSignedIn, loading, refreshActor, logout } = useStaffAuth()
  if (!loading && actor) return <Navigate to={actor.role === 'admin' ? '/' : '/unauthorized'} replace />

  return (
    <main className="admin-auth-page min-h-screen px-4 py-12 sm:py-20">
      <section className="mx-auto max-w-md">
        <header className="mb-8 text-center">
          <img src={logo} alt="MediCare" className="mx-auto h-14 w-14 rounded-2xl border border-emerald-100 bg-white shadow-sm" />
          <p className="mt-5 text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Administration</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">A connected care workspace.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Sign in with your authorized administrator account.</p>
        </header>
        {loading ? <LoadingState label="Preparing secure sign in..." /> : error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <ErrorMessage message={error} />
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={refreshActor} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Try again</button>
              <button type="button" onClick={logout} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Use another account</button>
            </div>
          </div>
        ) : !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? (
          <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm leading-6 text-slate-600">Administrator sign in is not configured on this installation. Contact your system administrator to enable access.</p>
        ) : !isSignedIn ? (
          <SignIn routing="path" path="/admin/login" forceRedirectUrl="/" withSignUp={false} fallback={<LoadingState label="Loading secure sign in..." />} appearance={{ variables: { colorPrimary: '#08735f', borderRadius: '0.85rem' }, elements: { rootBox: 'w-full', cardBox: 'w-full shadow-xl shadow-emerald-950/5' } }} />
        ) : <LoadingState label="Verifying administrator access..." />}
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} /> Access is verified before opening your workspace.</p>
        <Link to="/login" className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft size={15} /> All login portals</Link>
      </section>
    </main>
  )
}
