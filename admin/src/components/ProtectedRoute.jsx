import { LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useStaffAuth } from '../auth/staffAuth'
import { ROLE_LOGIN_PATH } from '../auth/rolePortals'

export default function ProtectedRoute({ allowedRoles }) {
  const location = useLocation()
  const { actor, error, isSignedIn, loading, refreshActor } = useStaffAuth()

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          <LoaderCircle size={19} className="animate-spin text-emerald-600" /> Verifying secure access...
        </div>
      </main>
    )
  }

  if (!isSignedIn) {
    const roleLogin = allowedRoles.length === 1 ? ROLE_LOGIN_PATH[allowedRoles[0]] : ''
    return <Navigate to={roleLogin || '/login'} replace state={{ from: location }} />
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-xl">
          <p className="text-sm font-bold text-rose-700">{error}</p>
          <button type="button" onClick={refreshActor} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Try again</button>
        </section>
      </main>
    )
  }

  if (!actor || actor.staff?.status === 'inactive' || !allowedRoles.includes(actor.role)) {
    return <Navigate to="/unauthorized" replace />
  }
  return <Outlet />
}
