import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useClerk } from '@clerk/react'
import { CalendarCheck, CalendarDays, CheckCircle2, Clock3, LoaderCircle, RefreshCw, ShieldCheck, Stethoscope, X, XCircle } from 'lucide-react'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { EmptyState, ErrorState, ImageWithFallback, LoadingPanel, PageIntro } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { appointmentImage, formatAppointmentTime, formatCurrency, formatDate, getId, statusClass } from '../lib/format'

const statuses = ['All', 'Pending', 'Confirmed', 'Rescheduled', 'Completed', 'Canceled']

export default function Appointments() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const clerk = useClerk()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [type, setType] = useState('All')
  const [status, setStatus] = useState('All')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const [notice, setNotice] = useState('')

  const loadAppointments = useCallback(async (refresh = false) => {
    if (!isSignedIn) {
      setItems([])
      setLoading(false)
      return
    }
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const token = await getToken()
      const [doctorResult, serviceResult] = await Promise.allSettled([
        patientApi.getMyAppointments(token),
        patientApi.getMyServiceAppointments(token),
      ])
      const failures = []
      const doctorItems = doctorResult.status === 'fulfilled' ? doctorResult.value : (failures.push('doctor appointments'), [])
      const serviceItems = serviceResult.status === 'fulfilled' ? serviceResult.value : (failures.push('service appointments'), [])
      setItems([
        ...doctorItems.map((item) => ({ ...item, kind: 'Doctor' })),
        ...serviceItems.map((item) => ({ ...item, kind: 'Service' })),
      ].sort((first, second) => appointmentTimestamp(second) - appointmentTimestamp(first)))
      if (failures.length) setError(`Some information could not be loaded: ${failures.join(' and ')}.`)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your appointments.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [getToken, isSignedIn])

  useEffect(() => {
    if (!isLoaded) return undefined
    const timeout = window.setTimeout(() => loadAppointments(), 0)
    return () => window.clearTimeout(timeout)
  }, [isLoaded, loadAppointments])

  useEffect(() => {
    if (!cancelTarget) return undefined
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [cancelTarget])

  const filtered = useMemo(() => items.filter((item) => {
    const typeMatch = type === 'All' || item.kind === type
    const statusMatch = status === 'All' || item.status === status
    return typeMatch && statusMatch
  }), [items, status, type])

  const summary = useMemo(() => ({
    upcoming: items.filter((item) => !['Completed', 'Canceled'].includes(item.status)).length,
    completed: items.filter((item) => item.status === 'Completed').length,
    canceled: items.filter((item) => item.status === 'Canceled').length,
  }), [items])

  async function confirmCancellation() {
    if (!cancelTarget) return
    setCanceling(true)
    setNotice('')
    try {
      const token = await getToken()
      if (cancelTarget.kind === 'Service') await patientApi.cancelServiceAppointment(getId(cancelTarget), token)
      else await patientApi.cancelAppointment(getId(cancelTarget), token)
      const canceledId = getId(cancelTarget)
      setItems((current) => current.map((item) => getId(item) === canceledId && item.kind === cancelTarget.kind ? { ...item, status: 'Canceled' } : item))
      setCancelTarget(null)
      setNotice('Your appointment was canceled successfully.')
    } catch (cancelError) {
      setError(cancelError.message || 'Unable to cancel this appointment.')
      setCancelTarget(null)
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="patient-site">
      <Navbar />
      <main className="patient-page">
        <div className="patient-page__inner">
          <PageIntro kicker="Your care schedule" title="My appointments" description="Review doctor visits and service bookings, payment details, status updates, and upcoming care." actions={isSignedIn && <button type="button" onClick={() => loadAppointments(true)} disabled={refreshing} className="patient-refresh-button"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}</button>} />

          {!isLoaded || loading ? <LoadingPanel label="Loading your appointments..." /> : !isSignedIn ? (
            <section className="patient-auth-gate"><span><ShieldCheck size={27} /></span><p>Private patient area</p><h2>Sign in to see your appointments.</h2><small>Your bookings are connected securely to your MediCare patient account.</small><button type="button" onClick={() => clerk.openSignIn()}>Sign in to continue</button></section>
          ) : (
            <>
              {error && <ErrorState message={error} onRetry={() => loadAppointments(true)} />}
              {notice && <div className="patient-notice"><CheckCircle2 size={17} /> {notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
              <section className="appointment-summary-grid">
                <Summary icon={CalendarCheck} label="Upcoming" value={summary.upcoming} tone="green" />
                <Summary icon={CheckCircle2} label="Completed" value={summary.completed} tone="blue" />
                <Summary icon={XCircle} label="Canceled" value={summary.canceled} tone="rose" />
              </section>
              <section className="appointment-toolbar">
                <div className="patient-filter-pills">{['All', 'Doctor', 'Service'].map((value) => <button type="button" key={value} onClick={() => setType(value)} className={type === value ? 'is-active' : ''}>{value === 'All' ? 'All bookings' : `${value} visits`}</button>)}</div>
                <label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((value) => <option key={value} value={value}>{value === 'All' ? 'All statuses' : value}</option>)}</select></label>
              </section>

              {filtered.length === 0 ? <EmptyState title={items.length ? 'No appointments match' : 'No appointments yet'} message={items.length ? 'Choose a different booking type or status.' : 'Book a doctor or medical service and your care schedule will appear here.'} actionLabel="Find a doctor" actionTo="/doctors" /> : <section className="patient-appointment-list">{filtered.map((item) => <AppointmentCard key={`${item.kind}-${getId(item)}`} item={item} onCancel={() => setCancelTarget(item)} />)}</section>}
            </>
          )}
        </div>
      </main>
      <Footer />
      {cancelTarget && <CancelModal item={cancelTarget} canceling={canceling} onClose={() => !canceling && setCancelTarget(null)} onConfirm={confirmCancellation} />}
    </div>
  )
}

function AppointmentCard({ item, onCancel }) {
  const service = item.kind === 'Service'
  const name = service ? item.serviceName || item.serviceId?.name || 'Medical service' : item.doctorName || item.doctorId?.name || 'MediCare doctor'
  const detail = service ? 'Clinical service' : item.speciality || item.doctorId?.specialization || 'Doctor consultation'
  const terminal = ['Completed', 'Canceled'].includes(item.status)
  return (
    <article className="patient-appointment-card">
      <div className="patient-appointment-card__image"><ImageWithFallback src={appointmentImage(item, service ? 'service' : 'doctor')} alt={name} initials={service ? 'MC' : initials(name)} /><span>{service ? <Stethoscope size={14} /> : <CalendarDays size={14} />}{item.kind}</span></div>
      <div className="patient-appointment-card__main"><div><p>{detail}</p><h2>{name}</h2></div><span className={statusClass(item.status)}><i />{item.status || 'Pending'}</span></div>
      <div className="patient-appointment-card__details"><span><CalendarDays size={16} /><small>Date</small><strong>{formatDate(item.date)}</strong></span><span><Clock3 size={16} /><small>Time</small><strong>{formatAppointmentTime(item)}</strong></span><span><span className="appointment-money">৳</span><small>Fee</small><strong>{formatCurrency(item.fees)}</strong></span><span><ShieldCheck size={16} /><small>Payment</small><strong>{item.payment?.method || 'Cash'} · {item.payment?.status || 'Pending'}</strong></span></div>
      <div className="patient-appointment-card__footer"><p>Booked {formatCreatedAt(item.createdAt)}</p>{!terminal && <button type="button" onClick={onCancel}>Cancel appointment</button>}</div>
    </article>
  )
}

function Summary({ icon: Icon, label, value, tone }) {
  return <article className={`appointment-summary appointment-summary--${tone}`}><span><Icon size={20} /></span><div><p>{label}</p><strong>{value}</strong></div></article>
}

function CancelModal({ item, canceling, onClose, onConfirm }) {
  return <div className="patient-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><button type="button" className="patient-modal__backdrop" onClick={onClose} aria-label="Close" /><div className="patient-modal__panel"><span className="patient-modal__warning"><XCircle size={23} /></span><h2 id="cancel-title">Cancel this appointment?</h2><p>This will cancel your {item.kind.toLowerCase()} booking on {formatDate(item.date)} at {formatAppointmentTime(item)}.</p><div><button type="button" onClick={onClose} disabled={canceling}>Keep appointment</button><button type="button" onClick={onConfirm} disabled={canceling}>{canceling && <LoaderCircle size={16} className="animate-spin" />}{canceling ? 'Canceling...' : 'Yes, cancel'}</button></div></div></div>
}

function appointmentTimestamp(item) {
  const date = new Date(`${item.date || '1970-01-01'}T00:00:00`)
  return Number.isNaN(date.getTime()) ? new Date(item.createdAt || 0).getTime() : date.getTime()
}

function formatCreatedAt(value) {
  if (!value) return 'recently'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric' })
}

function initials(value = 'Doctor') {
  return value.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}
