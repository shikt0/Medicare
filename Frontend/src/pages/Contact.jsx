import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/react'
import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, Mail, MessageCircle, Send, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { PageIntro } from '../components/PatientUi'
import { patientApi } from '../lib/api'

const initialForm = { name: '', email: '', mobile: '', subject: 'Appointment support', message: '' }

export default function Contact() {
  const { getToken, isSignedIn } = useAuth()
  const { user } = useUser()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    setForm((current) => ({
      ...current,
      name: current.name || user.fullName || '',
      email: current.email || user.primaryEmailAddress?.emailAddress || '',
      mobile: current.mobile || user.primaryPhoneNumber?.phoneNumber || '',
    }))
  }, [user])

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError('Complete the required fields before sending your message.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Enter a valid email address.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const token = isSignedIn ? await getToken() : undefined
      await patientApi.sendContactMessage({ ...form, name: form.name.trim(), email: form.email.trim(), message: form.message.trim() }, token)
      setSuccess('Your message has been received. The MediCare team can now follow up with you.')
      setForm((current) => ({ ...initialForm, name: current.name, email: current.email, mobile: current.mobile }))
    } catch (submitError) {
      setError(submitError.message || 'Unable to send your message.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="patient-site">
      <Navbar />
      <main className="patient-page contact-page">
        <div className="patient-page__inner">
          <PageIntro kicker="Patient support" title="How can we help?" description="Send a message to the MediCare team for appointment, service, or general patient support." />
          <div className="contact-layout">
            <form onSubmit={submit} className="contact-form" noValidate>
              <div className="booking-section-heading"><span><MessageCircle size={20} /></span><div><h2>Send us a message</h2><p>Required fields are marked with an asterisk.</p></div></div>
              <div className="patient-form-grid">
                <Field label="Full name" name="name" value={form.name} onChange={updateForm} placeholder="Your name" required />
                <Field label="Email address" name="email" type="email" value={form.email} onChange={updateForm} placeholder="you@example.com" required />
                <Field label="Mobile number" name="mobile" value={form.mobile} onChange={updateForm} placeholder="Optional" />
                <label className="patient-field"><span>What do you need help with?<i>*</i></span><select name="subject" value={form.subject} onChange={updateForm}><option>Appointment support</option><option>Doctor information</option><option>Service information</option><option>Payment question</option><option>Technical support</option><option>General question</option></select></label>
              </div>
              <label className="patient-field"><span>Message<i>*</i><small>{form.message.length}/2000</small></span><textarea name="message" value={form.message} onChange={updateForm} rows="7" maxLength="2000" placeholder="Tell us how we can help" required /></label>
              {error && <p className="patient-form-error" role="alert">{error}</p>}
              {success && <p className="patient-form-success" role="status"><CheckCircle2 size={17} /> {success}</p>}
              <button type="submit" disabled={submitting} className="patient-submit-button">{submitting ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={17} />}{submitting ? 'Sending...' : 'Send message'}</button>
            </form>

            <aside className="contact-support-panel">
              <div className="contact-support-panel__header"><span><ShieldCheck size={22} /></span><p>Patient-first support</p><h2>Start with the right path.</h2><small>For faster help, choose one of these direct care options.</small></div>
              <div className="contact-support-links">
                <Link to="/doctors"><span><Stethoscope size={19} /></span><div><strong>Find a doctor</strong><small>Browse specialists and availability</small></div></Link>
                <Link to="/services"><span><CalendarDays size={19} /></span><div><strong>Book a service</strong><small>Explore tests and clinical care</small></div></Link>
                <Link to="/appointments"><span><Clock3 size={19} /></span><div><strong>My appointments</strong><small>Review or manage existing bookings</small></div></Link>
              </div>
              <div className="contact-response-note"><Mail size={17} /><p><strong>Your message is securely recorded.</strong><span>Please provide accurate contact details so the care team can follow up.</span></p></div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Field({ label, required, ...props }) {
  return <label className="patient-field"><span>{label}{required && <i>*</i>}</span><input {...props} required={required} /></label>
}
