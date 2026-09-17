import { SignIn, SignUp, useAuth } from '@clerk/react'
import { ArrowLeft, HeartPulse, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import logo from '../assets/logo.png'

export default function PatientLogin({ mode = 'sign-in' }) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <main className="patient-auth-page"><LoaderCircle className="animate-spin text-emerald-700" size={25} /></main>
  }
  if (isSignedIn) return <Navigate to="/appointments" replace />

  return (
    <main className="patient-auth-page">
      <section className="patient-auth-shell">
        <div className="patient-auth-shell__intro">
          <Link to="/" className="patient-auth-shell__brand"><span><img src={logo} alt="" /></span><strong>MediCare</strong></Link>
          <div>
            <span className="patient-auth-shell__symbol"><HeartPulse size={27} /></span>
            <p>Private patient access</p>
            <h1>Your care, securely connected.</h1>
            <small>Use your MediCare patient account to manage bookings, appointments, and laboratory results.</small>
          </div>
          <p className="patient-auth-shell__trust"><ShieldCheck size={16} /> Protected patient workspace</p>
        </div>
        <div className="patient-auth-shell__form">
          {mode === 'sign-up' ? (
            <SignUp routing="path" path="/patient-sign-up" signInUrl="/patient-login" forceRedirectUrl="/appointments" />
          ) : (
            <SignIn routing="path" path="/patient-login" signUpUrl="/patient-sign-up" forceRedirectUrl="/appointments" />
          )}
          <Link to="/login" className="patient-auth-shell__back"><ArrowLeft size={15} /> All login portals</Link>
        </div>
      </section>
    </main>
  )
}
