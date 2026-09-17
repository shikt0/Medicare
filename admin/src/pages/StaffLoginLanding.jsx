import {
  ArrowRight,
  BriefcaseBusiness,
  FlaskConical,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const patientUrl = (import.meta.env.VITE_PATIENT_URL || 'http://localhost:5173').replace(/\/$/, '')
const workforceUrl = (import.meta.env.VITE_WORKFORCE_URL || 'http://localhost:5175').replace(/\/$/, '')

const portals = [
  { role: 'Patient', href: `${patientUrl}/patient-login`, icon: HeartPulse, external: true, text: 'Appointments, bookings, and laboratory results.' },
  { role: 'Doctor', href: `${patientUrl}/doctor/login`, icon: Stethoscope, external: true, text: 'Clinical appointments, schedules, and laboratory orders.' },
  { role: 'Nurse', href: `${workforceUrl}/nurse/login`, icon: UserRound, external: true, text: 'Duty schedule, patient context, announcements, and profile.' },
  { role: 'Pathologist', href: `${workforceUrl}/pathologist/login`, icon: FlaskConical, external: true, text: 'Laboratory queue, test progress, and result submission.' },
  { role: 'HR', href: `${workforceUrl}/hr/login`, icon: UsersRound, external: true, text: 'Workforce, duty planning, recruitment, and announcements.' },
  { role: 'Freelancer', href: `${workforceUrl}/freelancer/login`, icon: BriefcaseBusiness, external: true, text: 'Assignments, progress updates, announcements, and profile.' },
]

export default function StaffLoginLanding() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_8%,rgba(52,211,153,.14),transparent_25rem),linear-gradient(180deg,#f8fbfa,#edf6f2)] px-4 py-10 sm:py-14">
      <section className="mx-auto max-w-5xl">
        <header className="mx-auto max-w-2xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-lg shadow-emerald-950/10"><img src={logo} alt="" className="h-full w-full object-cover" /></span>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[.18em] text-emerald-700">MediCare secure access</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Choose your portal</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">Sign in through your assigned role. Administrator access is separate and is not included in this directory.</p>
        </header>

        <div className="mt-9 grid gap-3 md:grid-cols-2">
          {portals.map(({ role, href, icon: Icon, external, text }) => {
            const content = (
              <>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon size={22} /></span>
                <span className="min-w-0 flex-1"><strong className="block text-base font-extrabold text-slate-900">{role} portal</strong><small className="mt-1 block text-xs leading-5 text-slate-500">{text}</small></span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500"><ArrowRight size={16} /></span>
              </>
            )
            const className = 'flex min-h-28 items-center gap-4 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-950/5'

            return external
              ? <a key={role} href={href} className={className}>{content}</a>
              : <Link key={role} to={href} className={className}>{content}</Link>
          })}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs font-semibold text-slate-400"><ShieldCheck size={15} /> Use the email and password provided by your MediCare administrator.</p>
      </section>
    </main>
  )
}
