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
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'

const workforceUrl = (import.meta.env.VITE_WORKFORCE_URL || 'http://localhost:5175').replace(/\/$/, '')

const portals = [
  {
    role: 'Patient',
    description: 'Book care, review appointments, and access completed laboratory results.',
    href: '/patient-login',
    icon: HeartPulse,
    internal: true,
  },
  {
    role: 'Doctor',
    description: 'Open the clinical workspace for appointments, schedules, and laboratory orders.',
    href: '/doctor/login',
    icon: Stethoscope,
    internal: true,
  },
  {
    role: 'Nurse',
    description: 'View assigned duties, announcements, patient context, and your staff profile.',
    href: `${workforceUrl}/nurse/login`,
    icon: UserRound,
  },
  {
    role: 'Pathologist',
    description: 'Manage the assigned laboratory queue and submit factual test results.',
    href: `${workforceUrl}/pathologist/login`,
    icon: FlaskConical,
  },
  {
    role: 'HR',
    description: 'Manage workforce records, duty schedules, recruitment, and announcements.',
    href: `${workforceUrl}/hr/login`,
    icon: UsersRound,
  },
  {
    role: 'Freelancer',
    description: 'Review your assignments, update progress, and read team announcements.',
    href: `${workforceUrl}/freelancer/login`,
    icon: BriefcaseBusiness,
  },
]

export default function LoginPortal() {
  return (
    <div className="patient-site">
      <Navbar />
      <main className="portal-directory-page">
        <section className="portal-directory">
          <header className="portal-directory__header">
            <span><ShieldCheck size={25} /></span>
            <p>Secure MediCare access</p>
            <h1>Choose your portal</h1>
            <small>Select your assigned role to continue. Administrator access is intentionally separate and is not listed here.</small>
          </header>

          <div className="portal-directory__grid">
            {portals.map(({ role, description, href, icon: Icon, internal }) => {
              const content = (
                <>
                  <span className="portal-directory__icon"><Icon size={23} /></span>
                  <span className="portal-directory__copy"><strong>{role} portal</strong><small>{description}</small></span>
                  <span className="portal-directory__arrow"><ArrowRight size={17} /></span>
                </>
              )

              return internal
                ? <Link key={role} to={href} className="portal-directory__card">{content}</Link>
                : <a key={role} href={href} className="portal-directory__card">{content}</a>
            })}
          </div>

          <p className="portal-directory__note">Staff use the email and password provided when Admin creates their active staff record.</p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
