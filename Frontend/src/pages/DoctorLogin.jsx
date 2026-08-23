import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { patientApi } from '../lib/api'
import { readDoctorSession, saveDoctorSession } from '../lib/doctorSession'

export default function DoctorLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (readDoctorSession()) navigate('/doctor-portal', { replace: true })
  }, [navigate])

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Enter your doctor email and password.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = await patientApi.doctorLogin({ email: form.email.trim(), password: form.password })
      saveDoctorSession({ token: payload.token, doctor: payload.data })
      const destination = import.meta.env.VITE_DOCTOR_ADMIN_URL
      if (destination) window.location.assign(destination)
      else navigate('/doctor-portal', { replace: true })
    } catch (loginError) {
      setError(loginError.status === 401 ? 'The email or password is incorrect.' : loginError.message || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="patient-site">
      <Navbar />
      <main className="doctor-login-page">
        <section className="doctor-login-card">
          <div className="doctor-login-card__intro">
            <span><Stethoscope size={29} /></span><p>MediCare clinical workspace</p><h1>Welcome back, doctor.</h1><small>Sign in with your professional account to continue to the protected clinical workspace.</small>
            <div><ShieldCheck size={18} /><p><strong>Dedicated professional access</strong><span>This login is separate from the patient account system.</span></p></div>
          </div>
          <div className="doctor-login-card__form-area">
            <form onSubmit={submit} noValidate><div><p>Doctor portal</p><h2>Sign in to continue</h2><small>Use the email and password provided with your doctor account.</small></div><label className="doctor-login-field"><span>Email address</span><i><Mail size={17} /></i><input type="email" name="email" value={form.email} onChange={updateForm} autoComplete="email" placeholder="doctor@example.com" /></label><label className="doctor-login-field"><span>Password</span><i><LockKeyhole size={17} /></i><input type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={updateForm} autoComplete="current-password" placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></label>{error && <p className="patient-form-error" role="alert">{error}</p>}<button type="submit" disabled={submitting} className="patient-submit-button">{submitting ? <LoaderCircle size={18} className="animate-spin" /> : <LockKeyhole size={17} />}{submitting ? 'Signing in...' : 'Sign in securely'}</button><Link to="/" className="doctor-login-back"><ArrowLeft size={15} /> Back to patient site</Link></form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
