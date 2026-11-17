import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/react'
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Clock3, FileText, LoaderCircle, Microscope, ShieldCheck, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { ErrorState, ImageWithFallback, LoadingPanel } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { formatCurrency, getId } from '../lib/format'
import { patientDetailsError } from '../lib/validation'

const emptyForm = { patientName: '', mobile: '', age: '', gender: '', notes: '', paymentMethod: 'Cash' }

export default function ServiceDetails() {
  const { id } = useParams()
  const { isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const clerk = useClerk()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const requestVersion = useRef(0)

  const loadService = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    try {
      const details = await patientApi.getService(id)
      if (version !== requestVersion.current) return
      if (!details) throw new Error('This service is no longer available.')
      setService(details)
      setSuccess('')
    } catch (loadError) {
      if (version !== requestVersion.current) return
      setError(loadError.message || 'Unable to load this service.')
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timeout = window.setTimeout(loadService, 0)
    return () => { window.clearTimeout(timeout); requestVersion.current += 1 }
  }, [loadService])

  useEffect(() => {
    if (!user) return
    setForm((current) => ({ ...current, patientName: current.patientName || user.fullName || '', mobile: current.mobile || user.primaryPhoneNumber?.phoneNumber || '' }))
  }, [user])

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFormError('')
  }

  async function bookService(event) {
    event.preventDefault()
    if (submitting || success) return
    setSuccess('')
    if (!isSignedIn) {
      await clerk.openSignIn()
      return
    }
    const validationError = patientDetailsError(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Sign in again to request a service.')
      const payload = await patientApi.createServiceAppointment({
        serviceId: getId(service),
        serviceName: service.name,
        patientName: form.patientName.trim(),
        mobile: form.mobile.trim(),
        age: form.age === '' ? undefined : Number(form.age),
        gender: form.gender,
        notes: form.notes.trim(),
        paymentMethod: Number(service.price || 0) === 0 ? 'Cash' : form.paymentMethod,
        email: user?.primaryEmailAddress?.emailAddress || undefined,
      }, token)
      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
        return
      }
      const assignedName = payload.appointment?.assignedPathologistName
      setSuccess(assignedName
        ? `Your service request was submitted and assigned to ${assignedName}.`
        : 'Your service request was submitted. Pathologist assignment is pending.')
    } catch (bookingError) {
      setFormError(bookingError.message || 'Unable to book this service.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="patient-site">
      <Navbar />
      <main className="patient-page patient-detail-page">
        <div className="patient-page__inner">
          <Link to="/services" className="patient-back-link"><ArrowLeft size={16} /> Back to services</Link>
          {error ? <ErrorState message={error} onRetry={loadService} /> : loading ? <LoadingPanel label="Loading service details..." /> : service && (
            <>
              <section className="service-profile-hero">
                <div className="service-profile-hero__image"><ImageWithFallback src={service.imageUrl} alt={service.name} initials="MC" /><span className="availability-pill availability-pill--available"><i />Open 24/7</span></div>
                <div className="service-profile-hero__copy">
                  <p><Microscope size={15} /> MediCare clinical service</p>
                  <h1>{service.name || 'Medical service'}</h1>
                  <span className="service-profile-hero__short">{service.shortDescription || 'Professional care with straightforward booking and preparation guidance.'}</span>
                  <div className="service-profile-hero__price"><WalletCards size={20} /><div><small>Service fee</small><strong>{formatCurrency(service.price)}</strong></div></div>
                  <p className="service-profile-hero__about">{service.about || 'This service is delivered by the MediCare clinical team with a focus on patient comfort, clarity, and dependable results.'}</p>
                </div>
              </section>

              <div className="booking-layout">
                <div className="service-booking-info">
                  <section className="booking-schedule-panel">
                    <div className="booking-section-heading"><span><Clock3 size={20} /></span><div><h2>Open 24 hours a day</h2><p>Submit this service request whenever you need it—there is no date or time schedule.</p></div></div>
                    <div className="booking-schedule-message"><CheckCircle2 size={22} /><h3>Available now</h3><p>Your request will be shared with a member of our laboratory team, who will guide your next steps.</p></div>
                  </section>
                  <section className="service-instructions-panel"><div className="booking-section-heading"><span><FileText size={20} /></span><div><h2>Before your appointment</h2><p>Preparation guidance from the care team.</p></div></div>{Array.isArray(service.instructions) && service.instructions.length ? <ul>{service.instructions.map((instruction) => <li key={instruction}><Check size={15} /> {instruction}</li>)}</ul> : <p className="service-instructions-panel__empty">Preparation instructions are not available yet. Please confirm any requirements with your care team before your visit.</p>}</section>
                </div>

                <form onSubmit={bookService} className="patient-booking-form" noValidate>
                  <div className="booking-section-heading"><span><CheckCircle2 size={20} /></span><div><h2>Patient details</h2><p>Tell us who this appointment is for.</p></div></div>
                  {!isSignedIn && <div className="patient-signin-notice"><ShieldCheck size={17} /><p>Sign in securely to complete your booking.</p><button type="button" onClick={() => clerk.openSignIn()}>Sign in</button></div>}
                  <div className="patient-form-grid"><Field label="Patient name" name="patientName" value={form.patientName} onChange={updateForm} placeholder="Full name" required /><Field label="Mobile number" name="mobile" type="tel" autoComplete="tel" value={form.mobile} onChange={updateForm} placeholder="01XXXXXXXXX" required /><Field label="Age" name="age" type="number" min="0" max="120" value={form.age} onChange={updateForm} placeholder="Age" /><label className="patient-field"><span>Gender</span><select name="gender" value={form.gender} onChange={updateForm}><option value="">Prefer not to say</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label></div>
                  <label className="patient-field"><span>Notes <small>Optional</small></span><textarea name="notes" value={form.notes} onChange={updateForm} rows="3" maxLength="1000" placeholder="Share any relevant information for the service team" /></label>
                  {Number(service.price || 0) > 0 && <div className="payment-options"><p>Payment method</p><label className={form.paymentMethod === 'Cash' ? 'is-selected' : ''}><input type="radio" name="paymentMethod" value="Cash" checked={form.paymentMethod === 'Cash'} onChange={updateForm} /><span><strong>Pay at appointment</strong><small>Cash payment</small></span></label><label className={form.paymentMethod === 'Online' ? 'is-selected' : ''}><input type="radio" name="paymentMethod" value="Online" checked={form.paymentMethod === 'Online'} onChange={updateForm} /><span><strong>Pay securely online</strong><small>Continue to checkout</small></span></label></div>}
                  <div className="booking-summary"><div><span>Service availability</span><strong>24/7 · Assigned automatically</strong></div><div><span>Service fee</span><strong>{formatCurrency(service.price)}</strong></div></div>
                  {formError && <p className="patient-form-error" role="alert">{formError}</p>}
                  {success && <p className="patient-form-success" role="status"><CheckCircle2 size={17} /> {success} <Link to="/appointments">View appointments</Link></p>}
                  <button type="submit" disabled={submitting || Boolean(success)} className="patient-submit-button">{submitting ? <LoaderCircle size={18} className="animate-spin" /> : <CalendarDays size={18} />}{submitting ? 'Submitting...' : success ? 'Request submitted' : isSignedIn ? 'Submit service request' : 'Sign in to request'}</button>
                  {success && <button type="button" className="patient-refresh-button" onClick={() => { setSuccess(''); setForm((current) => ({ ...emptyForm, patientName: current.patientName, mobile: current.mobile })) }}>Make another request</button>}
                </form>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Field({ label, required, ...props }) {
  return <label className="patient-field"><span>{label}{required && <i>*</i>}</span><input {...props} required={required} /></label>
}
