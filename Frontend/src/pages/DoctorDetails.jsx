import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useClerk, useUser } from '@clerk/react'
import { ArrowLeft, Award, CalendarDays, CheckCircle2, Clock3, GraduationCap, LoaderCircle, MapPin, ShieldCheck, Star, Stethoscope, WalletCards } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { ErrorState, ImageWithFallback, LoadingPanel } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { cleanSchedule, formatCurrency, formatDate, getId, isAvailable } from '../lib/format'

const emptyForm = { patientName: '', mobile: '', age: '', gender: '', notes: '', paymentMethod: 'Cash' }

export default function DoctorDetails() {
  const { id } = useParams()
  const { isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  const clerk = useClerk()
  const [doctor, setDoctor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  const loadDoctor = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDoctor(await patientApi.getDoctor(id))
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this doctor.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timeout = window.setTimeout(loadDoctor, 0)
    return () => window.clearTimeout(timeout)
  }, [loadDoctor])

  useEffect(() => {
    if (!user) return
    setForm((current) => ({
      ...current,
      patientName: current.patientName || user.fullName || '',
      mobile: current.mobile || user.primaryPhoneNumber?.phoneNumber || '',
    }))
  }, [user])

  const schedule = useMemo(() => cleanSchedule(doctor?.schedule, { bookedSlots: doctor?.bookedSlots, horizonDays: 28 }), [doctor])
  const selectedSlots = schedule.find((day) => day.date === selectedDate)?.slots || []
  const available = doctor ? isAvailable(doctor) : false

  function selectDate(date) {
    setSelectedDate(date)
    setSelectedTime('')
    setFormError('')
  }

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFormError('')
  }

  async function bookAppointment(event) {
    event.preventDefault()
    setSuccess('')
    if (!isSignedIn) {
      await clerk.openSignIn()
      return
    }
    if (!selectedDate || !selectedTime) {
      setFormError('Choose an available date and time before booking.')
      return
    }
    if (!form.patientName.trim() || !form.mobile.trim()) {
      setFormError('Enter the patient name and mobile number.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const token = await getToken()
      const payload = await patientApi.createAppointment({
        doctorId: getId(doctor),
        patientName: form.patientName.trim(),
        mobile: form.mobile.trim(),
        age: form.age || undefined,
        gender: form.gender,
        notes: form.notes.trim(),
        date: selectedDate,
        time: selectedTime,
        fee: Number(doctor.fee || 0),
        paymentMethod: Number(doctor.fee || 0) === 0 ? 'Cash' : form.paymentMethod,
        email: user?.primaryEmailAddress?.emailAddress || undefined,
      }, token)

      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
        return
      }
      setSuccess('Your appointment has been booked successfully.')
      setDoctor((current) => ({
        ...current,
        bookedSlots: {
          ...(current?.bookedSlots || {}),
          [selectedDate]: [...new Set([...(current?.bookedSlots?.[selectedDate] || []), selectedTime])],
        },
      }))
      setSelectedDate('')
      setSelectedTime('')
    } catch (bookingError) {
      setFormError(bookingError.message || 'Unable to book this appointment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="patient-site">
      <Navbar />
      <main className="patient-page patient-detail-page">
        <div className="patient-page__inner">
          <Link to="/doctors" className="patient-back-link"><ArrowLeft size={16} /> Back to doctors</Link>
          {error ? <ErrorState message={error} onRetry={loadDoctor} /> : loading ? <LoadingPanel label="Loading doctor profile..." /> : doctor && (
            <>
              <section className="doctor-profile-hero">
                <div className="doctor-profile-hero__image">
                  <ImageWithFallback src={doctor.imageUrl} alt={doctor.name} initials={initials(doctor.name)} />
                  <span className={available ? 'availability-pill availability-pill--available' : 'availability-pill'}><i />{available ? 'Available for booking' : 'Currently unavailable'}</span>
                </div>
                <div className="doctor-profile-hero__copy">
                  <p><Stethoscope size={15} /> {doctor.specialization || 'General medicine'}</p>
                  <h1>{doctor.name || 'MediCare doctor'}</h1>
                  <div className="doctor-profile-hero__meta">
                    <span><Star size={16} fill="currentColor" /> {Number(doctor.rating || 0).toFixed(1)} rating</span>
                    <span><MapPin size={16} /> {doctor.location || 'Location on request'}</span>
                    <span><WalletCards size={16} /> {formatCurrency(doctor.fee)} consultation</span>
                  </div>
                  <p className="doctor-profile-hero__about">{doctor.about || 'A dedicated healthcare professional focused on thoughtful, patient-centered care.'}</p>
                  <div className="doctor-profile-hero__facts">
                    <div><Award size={19} /><span><small>Experience</small><strong>{doctor.experience || 'Experienced clinician'}</strong></span></div>
                    <div><GraduationCap size={19} /><span><small>Qualifications</small><strong>{doctor.qualifications || 'Verified professional'}</strong></span></div>
                    <div><ShieldCheck size={19} /><span><small>Profile</small><strong>Verified by MediCare</strong></span></div>
                  </div>
                </div>
              </section>

              <div className="booking-layout">
                <section className="booking-schedule-panel">
                  <div className="booking-section-heading"><span><CalendarDays size={20} /></span><div><h2>Choose an appointment</h2><p>Select a date generated from the doctor’s weekly schedule.</p></div></div>
                  {!available ? <ScheduleMessage title="Bookings are paused" text="This doctor is currently unavailable. You can still review the profile or choose another doctor." /> : schedule.length === 0 ? <ScheduleMessage title="No upcoming slots" text="The doctor has not published any weekly appointment times yet. Please check again later." /> : (
                    <>
                      <div className="booking-date-grid">{schedule.map((day) => <button key={day.date} type="button" onClick={() => selectDate(day.date)} className={selectedDate === day.date ? 'is-selected' : ''}><small>{formatDate(day.date, { short: true })}</small><strong>{day.slots.length} slots</strong></button>)}</div>
                      {selectedDate && <div className="booking-time-section"><p><Clock3 size={15} /> Available times for {formatDate(selectedDate)}</p><div>{selectedSlots.map((slot) => <button key={slot} type="button" onClick={() => { setSelectedTime(slot); setFormError('') }} className={selectedTime === slot ? 'is-selected' : ''}>{slot}</button>)}</div></div>}
                    </>
                  )}
                </section>

                <form onSubmit={bookAppointment} className="patient-booking-form" noValidate>
                  <div className="booking-section-heading"><span><CheckCircle2 size={20} /></span><div><h2>Patient details</h2><p>We will use these details for your appointment.</p></div></div>
                  {!isSignedIn && <div className="patient-signin-notice"><ShieldCheck size={17} /><p>Sign in securely to complete your booking.</p><button type="button" onClick={() => clerk.openSignIn()}>Sign in</button></div>}
                  <div className="patient-form-grid">
                    <Field label="Patient name" name="patientName" value={form.patientName} onChange={updateForm} placeholder="Full name" required />
                    <Field label="Mobile number" name="mobile" value={form.mobile} onChange={updateForm} placeholder="01XXXXXXXXX" required />
                    <Field label="Age" name="age" type="number" min="0" max="120" value={form.age} onChange={updateForm} placeholder="Age" />
                    <label className="patient-field"><span>Gender</span><select name="gender" value={form.gender} onChange={updateForm}><option value="">Prefer not to say</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
                  </div>
                  <label className="patient-field"><span>Notes for the doctor <small>Optional</small></span><textarea name="notes" value={form.notes} onChange={updateForm} rows="3" maxLength="500" placeholder="Share anything helpful before your appointment" /></label>
                  {Number(doctor.fee || 0) > 0 && <div className="payment-options"><p>Payment method</p><label className={form.paymentMethod === 'Cash' ? 'is-selected' : ''}><input type="radio" name="paymentMethod" value="Cash" checked={form.paymentMethod === 'Cash'} onChange={updateForm} /><span><strong>Pay at appointment</strong><small>Cash payment</small></span></label><label className={form.paymentMethod === 'Online' ? 'is-selected' : ''}><input type="radio" name="paymentMethod" value="Online" checked={form.paymentMethod === 'Online'} onChange={updateForm} /><span><strong>Pay securely online</strong><small>Continue to checkout</small></span></label></div>}
                  <div className="booking-summary"><div><span>Selected appointment</span><strong>{selectedDate && selectedTime ? `${formatDate(selectedDate)} · ${selectedTime}` : 'Choose a date and time'}</strong></div><div><span>Consultation fee</span><strong>{formatCurrency(doctor.fee)}</strong></div></div>
                  {formError && <p className="patient-form-error" role="alert">{formError}</p>}
                  {success && <p className="patient-form-success" role="status"><CheckCircle2 size={17} /> {success} <Link to="/appointments">View appointments</Link></p>}
                  <button type="submit" disabled={submitting || !available || schedule.length === 0} className="patient-submit-button">{submitting ? <LoaderCircle size={18} className="animate-spin" /> : <CalendarDays size={18} />}{submitting ? 'Booking...' : isSignedIn ? 'Confirm appointment' : 'Sign in to book'}</button>
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

function ScheduleMessage({ title, text }) {
  return <div className="booking-schedule-message"><Clock3 size={22} /><h3>{title}</h3><p>{text}</p><Link to="/doctors">Choose another doctor</Link></div>
}

function initials(value = 'Doctor') {
  return value.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}
