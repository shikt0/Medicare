import { useState } from 'react'
import { Activity, ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useStaffAuth } from '../auth/staffAuth'
import { ROLE_PORTAL_HOME } from '../auth/rolePortals'
import logo from '../assets/logo.png'

const roleLabels = { nurse: 'Nurse', pathologist: 'Pathologist', hr: 'HR', freelancer: 'Freelancer' }

export default function WorkforceAuth({ expectedRole }) {
  const navigate = useNavigate()
  const { actor, isSignedIn, localAdminBypass, loading, login } = useStaffAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const roleLabel = roleLabels[expectedRole] || 'Staff'

  if (localAdminBypass) return <Navigate to="/" replace />
  if (!loading && isSignedIn) return <Navigate to={actor?.role === expectedRole ? ROLE_PORTAL_HOME[expectedRole] : '/unauthorized'} replace />

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFormError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.email.trim() || !form.password) {
      setFormError('Enter the email and password provided by your administrator.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const current = await login({ email: form.email.trim(), password: form.password, role: expectedRole })
      navigate(ROLE_PORTAL_HOME[current.role], { replace: true })
    } catch (loginError) {
      setFormError(loginError.message || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8f7] px-4 py-8 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-5xl overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 lg:grid-cols-[1fr_28rem]">
        <section className="relative hidden overflow-hidden bg-[#071b1c] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white"><img src={logo} alt="" className="h-full w-full object-cover" /></span>
            <div><strong className="block text-lg">MediCare</strong><span className="text-xs uppercase tracking-[.18em] text-emerald-200/70">{roleLabel} portal</span></div>
          </div>
          <div className="relative">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Activity size={24} /></span>
            <h1 className="mt-6 max-w-md text-4xl font-extrabold leading-tight tracking-tight">Welcome to the {roleLabel} workspace.</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-emerald-50/60">Use the email and password your MediCare administrator provided when creating your staff account.</p>
          </div>
          <p className="relative flex items-center gap-2 text-xs font-semibold text-white/45"><ShieldCheck size={15} /> Access is restricted to the assigned staff role</p>
        </section>

        <section className="flex flex-col justify-center p-6 sm:p-9">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-700"><Sparkles size={15} /> {roleLabel} secure access</div>
          <div className="mt-5"><h2 className="text-2xl font-extrabold tracking-tight text-slate-950">Sign in to your portal</h2><p className="mt-2 text-sm leading-6 text-slate-500">Only an active {roleLabel.toLowerCase()} account created by Admin can sign in here.</p></div>

          <form onSubmit={submit} className="mt-6" noValidate>
            <label className="block"><span className="mb-2 block text-xs font-bold text-slate-600">Email address</span><span className="relative block"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="email" name="email" value={form.email} onChange={updateForm} autoComplete="email" placeholder="staff@medicare.com" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" /></span></label>
            <label className="mt-4 block"><span className="mb-2 block text-xs font-bold text-slate-600">Password</span><span className="relative block"><LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={updateForm} autoComplete="current-password" placeholder="Enter your password" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            {formError && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700" role="alert">{formError}</p>}
            <button type="submit" disabled={submitting} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-lg shadow-emerald-800/15 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <LoaderCircle size={18} className="animate-spin" /> : <LockKeyhole size={17} />}{submitting ? 'Signing in...' : `Sign in as ${roleLabel}`}</button>
          </form>

          <Link to="/login" className="mt-5 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-700"><ArrowLeft size={14} /> All login portals</Link>
        </section>
      </div>
    </main>
  )
}
