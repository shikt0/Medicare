import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, Banknote, Bell, CalendarCheck, CalendarDays, Check, CheckCircle2,
  ChevronRight, CircleUserRound, ClipboardList, Clock3, Edit3, LayoutDashboard, LoaderCircle,
  LogOut, Menu, MessageSquareText, Phone, Plus, RefreshCw, Save, Search, ShieldCheck,
  Sparkles, UserRound, UsersRound, X, XCircle,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import { ErrorState, ImageWithFallback, LoadingPanel } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { clearDoctorSession, readDoctorSession, saveDoctorSession } from '../lib/doctorSession'
import { formatAppointmentTime, formatCurrency, formatDate, getId, isAvailable, localDateKey, statusClass } from '../lib/format'
import '../doctorPortal.css'

const navItems = [
  { label: 'Overview', path: '/doctor-portal', icon: LayoutDashboard, end: true },
  { label: 'Appointments', path: '/doctor-portal/appointments', icon: ClipboardList },
  { label: 'Schedule', path: '/doctor-portal/schedule', icon: CalendarDays },
  { label: 'Profile', path: '/doctor-portal/profile', icon: CircleUserRound },
]

const profileFields = ['name', 'specialization', 'experience', 'qualifications', 'location', 'about', 'fee']

export default function DoctorPortal() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(() => readDoctorSession())
  const [doctor, setDoctor] = useState(session?.doctor || null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scheduleDraft, setScheduleDraft] = useState(() => normalizeSchedule(session?.doctor?.schedule))
  const [profileDraft, setProfileDraft] = useState(() => profileFromDoctor(session?.doctor))

  const logout = useCallback(() => {
    clearDoctorSession()
    setSession(null)
    navigate('/doctor-admin/login', { replace: true })
  }, [navigate])

  const loadWorkspace = useCallback(async (refresh = false) => {
    if (!session?.token) return
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [profile, appointmentPayload] = await Promise.all([
        patientApi.getDoctorPortalMe(session.token),
        patientApi.getDoctorPortalAppointments(session.token, { limit: 200 }),
      ])
      setDoctor(profile)
      setAppointments(appointmentPayload.appointments || [])
      setScheduleDraft(normalizeSchedule(profile.schedule))
      setProfileDraft(profileFromDoctor(profile))
      const nextSession = { token: session.token, doctor: profile }
      saveDoctorSession(nextSession)
      setSession(nextSession)
    } catch (loadError) {
      if ([401, 403].includes(loadError.status)) {
        logout()
        return
      }
      setError(loadError.message || 'Unable to load the clinical workspace.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [logout, session?.token])

  useEffect(() => {
    if (!session?.token) {
      navigate('/doctor-admin/login', { replace: true })
      return undefined
    }
    const timeout = window.setTimeout(() => loadWorkspace(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadWorkspace, navigate, session?.token])

  useEffect(() => setMenuOpen(false), [location.pathname])

  function syncDoctor(nextDoctor) {
    setDoctor(nextDoctor)
    setScheduleDraft(normalizeSchedule(nextDoctor.schedule))
    setProfileDraft(profileFromDoctor(nextDoctor))
    const nextSession = { token: session.token, doctor: nextDoctor }
    saveDoctorSession(nextSession)
    setSession(nextSession)
  }

  async function toggleAvailability() {
    try {
      syncDoctor(await patientApi.toggleDoctorAvailability(getId(doctor), session.token))
      setNotice({ tone: 'success', text: `You are now ${isAvailable(doctor) ? 'unavailable' : 'available'} for new bookings.` })
    } catch (updateError) {
      setNotice({ tone: 'error', text: updateError.message || 'Unable to update availability.' })
    }
  }

  async function updateAppointment(id, changes, successMessage) {
    const updated = await patientApi.updateDoctorPortalAppointment(id, changes, session.token)
    setAppointments((current) => current.map((item) => getId(item) === getId(updated) ? updated : item))
    setNotice({ tone: 'success', text: successMessage || 'Appointment updated.' })
    return updated
  }

  async function saveSchedule() {
    const updated = await patientApi.updateDoctorProfile(getId(doctor), { schedule: scheduleDraft }, session.token)
    syncDoctor(updated)
    setNotice({ tone: 'success', text: 'Your appointment schedule has been published.' })
  }

  async function saveProfile() {
    const body = { ...profileDraft, fee: Number(profileDraft.fee || 0) }
    const updated = await patientApi.updateDoctorProfile(getId(doctor), body, session.token)
    syncDoctor(updated)
    setNotice({ tone: 'success', text: 'Your professional profile has been updated.' })
  }

  if (!session?.token) return null

  const section = location.pathname.split('/')[2] || 'overview'
  const pageTitle = navItems.find((item) => item.path.endsWith(section))?.label || (section === 'overview' ? 'Overview' : 'Clinical workspace')

  return (
    <div className="doctor-workspace">
      <aside className={`doctor-sidebar ${menuOpen ? 'doctor-sidebar--open' : ''}`}>
        <div className="doctor-sidebar__brand"><img src={logo} alt="" /><div><strong>MediCare</strong><span>Clinical workspace</span></div><button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button></div>
        <div className="doctor-sidebar__identity"><ImageWithFallback src={doctor?.imageUrl} alt={doctor?.name} initials={initials(doctor?.name)} /><div><span>Signed in as</span><strong>{doctor?.name || 'Doctor'}</strong><small>{doctor?.specialization || 'Medical professional'}</small></div></div>
        <nav aria-label="Doctor workspace">{navItems.map(({ label, path, icon: Icon, end }) => <NavLink key={path} to={path} end={end} className={({ isActive }) => isActive ? 'is-active' : ''}><Icon size={18} /><span>{label}</span><ChevronRight size={15} /></NavLink>)}</nav>
        <div className="doctor-sidebar__secure"><ShieldCheck size={18} /><div><strong>Protected access</strong><span>Doctor-only clinical workspace</span></div></div>
        <button type="button" className="doctor-sidebar__logout" onClick={logout}><LogOut size={17} /> Sign out</button>
      </aside>
      {menuOpen && <button type="button" className="doctor-sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <div className="doctor-workspace__main">
        <header className="doctor-topbar">
          <div><button type="button" className="doctor-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><span>Doctor portal</span><strong>{pageTitle}</strong></div></div>
          <div className="doctor-topbar__actions"><button type="button" onClick={() => loadWorkspace(true)} disabled={refreshing} aria-label="Refresh workspace"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button><span><Bell size={18} /><i>{appointments.filter((item) => item.status === 'Pending').length}</i></span><button type="button" onClick={toggleAvailability} className={isAvailable(doctor) ? 'doctor-availability doctor-availability--online' : 'doctor-availability'}><i />{isAvailable(doctor) ? 'Available' : 'Unavailable'}</button></div>
        </header>

        <main className="doctor-workspace__content">
          {notice && <div className={`doctor-notice doctor-notice--${notice.tone}`} role="status">{notice.tone === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}<span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}
          {error && <ErrorState message={error} onRetry={() => loadWorkspace(true)} />}
          {loading ? <LoadingPanel label="Preparing your clinical workspace..." /> : section === 'appointments' ? (
            <AppointmentsView appointments={appointments} onUpdate={updateAppointment} />
          ) : section === 'schedule' ? (
            <ScheduleView doctor={doctor} draft={scheduleDraft} setDraft={setScheduleDraft} onSave={saveSchedule} onToggleAvailability={toggleAvailability} />
          ) : section === 'profile' ? (
            <ProfileView doctor={doctor} draft={profileDraft} setDraft={setProfileDraft} onSave={saveProfile} />
          ) : (
            <OverviewView doctor={doctor} appointments={appointments} onUpdate={updateAppointment} />
          )}
        </main>
      </div>
    </div>
  )
}

function OverviewView({ doctor, appointments, onUpdate }) {
  const today = localDateKey(new Date())
  const todaysAppointments = appointments.filter((item) => item.date === today && item.status !== 'Canceled')
  const upcoming = appointments.filter((item) => item.date >= today && !['Completed', 'Canceled'].includes(item.status))
  const completed = appointments.filter((item) => item.status === 'Completed')
  const paidTotal = appointments.filter((item) => item.payment?.status === 'Paid').reduce((total, item) => total + Number(item.fees || 0), 0)
  const nextAppointment = [...upcoming].sort(sortAppointments)[0]
  const firstName = String(doctor?.name || 'Doctor').replace(/^Dr\.?\s*/i, '').split(' ')[0]

  return <>
    <section className="doctor-welcome-card">
      <div><p><Sparkles size={15} /> Clinical overview</p><h1>Good {dayPeriod()}, Dr. {firstName}.</h1><span>{todayLabel()} · Here is what is happening with your patients today.</span><div><Link to="/doctor-portal/appointments">Review appointments <ArrowRight size={16} /></Link><Link to="/doctor-portal/schedule">Manage availability</Link></div></div>
      <div className="doctor-welcome-card__pulse"><span><Activity size={28} /></span><p>Practice status</p><strong>{isAvailable(doctor) ? 'Accepting bookings' : 'Bookings paused'}</strong><small>{upcoming.length} upcoming patient {upcoming.length === 1 ? 'visit' : 'visits'}</small></div>
    </section>

    <section className="doctor-stat-grid">
      <StatCard icon={CalendarCheck} label="Today" value={todaysAppointments.length} detail="Scheduled visits" tone="green" />
      <StatCard icon={Clock3} label="Upcoming" value={upcoming.length} detail="Active appointments" tone="blue" />
      <StatCard icon={UsersRound} label="Completed" value={completed.length} detail="Patient consultations" tone="violet" />
      <StatCard icon={Banknote} label="Paid bookings" value={formatCurrency(paidTotal)} detail="Recorded payments" tone="amber" compact />
    </section>

    <div className="doctor-overview-grid">
      <section className="doctor-panel">
        <PanelHeading icon={Clock3} title="Today's appointments" text="Your patient schedule for today." action={<Link to="/doctor-portal/appointments">View all</Link>} />
        {todaysAppointments.length ? <div className="doctor-today-list">{[...todaysAppointments].sort(sortAppointments).map((item) => <TodayAppointment key={getId(item)} item={item} onUpdate={onUpdate} />)}</div> : <CompactEmpty icon={CalendarCheck} title="No visits scheduled today" text="New patient bookings for today will appear here." />}
      </section>
      <aside className="doctor-panel doctor-next-panel">
        <PanelHeading icon={CalendarDays} title="Next patient" text="Your nearest upcoming visit." />
        {nextAppointment ? <><div className="doctor-next-patient"><span>{initials(nextAppointment.patientName)}</span><p>Up next</p><h2>{nextAppointment.patientName}</h2><small>{nextAppointment.age ? `${nextAppointment.age} years` : 'Age not provided'}{nextAppointment.gender ? ` · ${nextAppointment.gender}` : ''}</small></div><div className="doctor-next-details"><span><CalendarDays size={16} /><small>Date</small><strong>{formatDate(nextAppointment.date)}</strong></span><span><Clock3 size={16} /><small>Time</small><strong>{formatAppointmentTime(nextAppointment)}</strong></span><span><Phone size={16} /><small>Contact</small><strong>{nextAppointment.mobile}</strong></span></div><Link to="/doctor-portal/appointments" className="doctor-panel-button">Open appointment <ArrowRight size={15} /></Link></> : <CompactEmpty icon={UserRound} title="No upcoming patient" text="Publish availability to receive new bookings." />}
      </aside>
    </div>
  </>
}

function AppointmentsView({ appointments, onUpdate }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [selected, setSelected] = useState(null)
  const [workingId, setWorkingId] = useState('')
  const [localError, setLocalError] = useState('')
  const statuses = ['All', 'Pending', 'Confirmed', 'Rescheduled', 'Completed', 'Canceled']
  const filtered = useMemo(() => appointments.filter((item) => {
    const keyword = query.trim().toLowerCase()
    return (status === 'All' || item.status === status) && (!keyword || [item.patientName, item.mobile].some((value) => String(value || '').toLowerCase().includes(keyword)))
  }).sort(sortAppointments), [appointments, query, status])

  async function quickUpdate(item, nextStatus) {
    setWorkingId(getId(item))
    setLocalError('')
    try { await onUpdate(getId(item), { status: nextStatus }, `Appointment marked ${nextStatus.toLowerCase()}.`) }
    catch (error) { setLocalError(error.message || 'Unable to update appointment.') }
    finally { setWorkingId('') }
  }

  return <section className="doctor-view">
    <ViewHeading kicker="Patient care" title="Appointments" text="Review patient details, confirm visits, record notes, and keep every appointment current." />
    <div className="doctor-appointment-tools"><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient or mobile number" />{query && <button type="button" onClick={() => setQuery('')}><X size={15} /></button>}</label><div>{statuses.map((value) => <button type="button" key={value} onClick={() => setStatus(value)} className={status === value ? 'is-active' : ''}>{value}</button>)}</div></div>
    <div className="doctor-results-row"><span>{filtered.length} {filtered.length === 1 ? 'appointment' : 'appointments'}</span>{(query || status !== 'All') && <button type="button" onClick={() => { setQuery(''); setStatus('All') }}>Clear filters</button>}</div>
    {localError && <p className="doctor-inline-error"><XCircle size={16} />{localError}</p>}
    {filtered.length ? <div className="doctor-appointment-list">{filtered.map((item) => <DoctorAppointmentCard key={getId(item)} item={item} working={workingId === getId(item)} onUpdate={quickUpdate} onOpen={() => setSelected(item)} />)}</div> : <CompactEmpty icon={ClipboardList} title="No appointments found" text="Try changing the search or status filter." />}
    {selected && <AppointmentManager item={appointments.find((item) => getId(item) === getId(selected)) || selected} onClose={() => setSelected(null)} onUpdate={onUpdate} />}
  </section>
}

function DoctorAppointmentCard({ item, working, onUpdate, onOpen }) {
  const terminal = ['Completed', 'Canceled'].includes(item.status)
  return <article className="doctor-appointment-row">
    <div className="doctor-patient-avatar">{initials(item.patientName)}</div>
    <div className="doctor-appointment-row__patient"><span>Patient</span><h2>{item.patientName}</h2><p><Phone size={13} />{item.mobile}<i />{item.age ? `${item.age} yrs` : 'Age —'}{item.gender && ` · ${item.gender}`}</p></div>
    <div className="doctor-appointment-row__when"><span><CalendarDays size={15} />{formatDate(item.date)}</span><span><Clock3 size={15} />{formatAppointmentTime(item)}</span></div>
    <div className="doctor-appointment-row__payment"><span className={statusClass(item.status)}><i />{item.status}</span><small>{item.payment?.method || 'Cash'} · {item.payment?.status || 'Pending'} · {formatCurrency(item.fees)}</small></div>
    <div className="doctor-appointment-row__actions">{item.status === 'Pending' && <button type="button" onClick={() => onUpdate(item, 'Confirmed')} disabled={working}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Confirm</button>}{['Confirmed', 'Rescheduled'].includes(item.status) && <button type="button" onClick={() => onUpdate(item, 'Completed')} disabled={working}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Complete</button>}<button type="button" onClick={onOpen} className="doctor-manage-button">Manage <ChevronRight size={15} /></button>{terminal && <span>Record closed</span>}</div>
  </article>
}

function AppointmentManager({ item, onClose, onUpdate }) {
  const [notes, setNotes] = useState(item.doctorNotes || '')
  const [date, setDate] = useState(item.date || '')
  const [time, setTime] = useState(toTwentyFourHour(item.time))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const terminal = ['Completed', 'Canceled'].includes(item.status)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  async function save(changes, message) {
    setSaving(true)
    setError('')
    try { await onUpdate(getId(item), changes, message); if (changes.status) onClose() }
    catch (saveError) { setError(saveError.message || 'Unable to update this appointment.') }
    finally { setSaving(false) }
  }

  return <div className="doctor-drawer" role="dialog" aria-modal="true" aria-labelledby="appointment-manager-title"><button type="button" className="doctor-drawer__backdrop" onClick={onClose} aria-label="Close appointment" /><div className="doctor-drawer__panel"><header><div><span>Patient appointment</span><h2 id="appointment-manager-title">{item.patientName}</h2></div><button type="button" onClick={onClose}><X size={20} /></button></header><div className="doctor-drawer__body">
    <div className="doctor-drawer__status"><span className={statusClass(item.status)}><i />{item.status}</span><small>Booked {createdLabel(item.createdAt)}</small></div>
    <section className="doctor-patient-details"><Detail icon={Phone} label="Mobile" value={item.mobile} /><Detail icon={UserRound} label="Patient" value={`${item.age || 'Age —'}${item.gender ? ` · ${item.gender}` : ''}`} /><Detail icon={CalendarDays} label="Appointment" value={`${formatDate(item.date)} · ${formatAppointmentTime(item)}`} /><Detail icon={Banknote} label="Payment" value={`${item.payment?.method || 'Cash'} · ${item.payment?.status || 'Pending'} · ${formatCurrency(item.fees)}`} /></section>
    {item.notes && <section className="doctor-patient-note"><span><MessageSquareText size={17} />Patient note</span><p>{item.notes}</p></section>}
    <label className="doctor-form-field"><span>Private clinical notes <small>{notes.length}/1000</small></span><textarea rows="5" maxLength="1000" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Record notes for this consultation" /></label>
    <button type="button" className="doctor-save-secondary" disabled={saving} onClick={() => save({ doctorNotes: notes }, 'Clinical notes saved.')}><Save size={16} /> Save clinical notes</button>
    {!terminal && <section className="doctor-reschedule-box"><div><span><CalendarDays size={17} />Reschedule appointment</span><small>Choose a future date and time.</small></div><div><label className="doctor-form-field"><span>New date</span><input type="date" min={localDateKey(new Date())} value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="doctor-form-field"><span>New time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div><button type="button" disabled={saving || !date || !time} onClick={() => save({ date, time: toTwelveHour(time), doctorNotes: notes }, 'Appointment rescheduled successfully.')}><RefreshCw size={16} /> Save new time</button></section>}
    {error && <p className="doctor-inline-error"><XCircle size={16} />{error}</p>}
  </div><footer>{!terminal && <><button type="button" disabled={saving} onClick={() => save({ status: item.status === 'Pending' ? 'Confirmed' : 'Completed', doctorNotes: notes }, item.status === 'Pending' ? 'Appointment confirmed.' : 'Appointment completed.')} className="doctor-drawer__primary"><CheckCircle2 size={16} />{item.status === 'Pending' ? 'Confirm appointment' : 'Mark completed'}</button><button type="button" disabled={saving} onClick={() => save({ status: 'Canceled', doctorNotes: notes }, 'Appointment canceled.')} className="doctor-drawer__danger">Cancel appointment</button></>}</footer></div></div>
}

function ScheduleView({ doctor, draft, setDraft, onSave, onToggleAvailability }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const today = localDateKey(new Date())
  const days = Object.entries(draft).sort(([first], [second]) => first.localeCompare(second))
  const upcomingDays = days.filter(([value]) => value >= today)
  const expiredCount = days.length - upcomingDays.length

  function addSlot() {
    if (!date || !time) { setMessage('Choose both a date and time.'); return }
    const value = toTwelveHour(time)
    setDraft((current) => ({ ...current, [date]: [...new Set([...(current[date] || []), value])].sort(sortTimes) }))
    setTime('')
    setMessage('')
  }

  function removeSlot(day, slot) {
    setDraft((current) => {
      const next = { ...current, [day]: current[day].filter((value) => value !== slot) }
      if (!next[day].length) delete next[day]
      return next
    })
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try { await onSave() }
    catch (error) { setMessage(error.message || 'Unable to publish schedule.') }
    finally { setSaving(false) }
  }

  return <section className="doctor-view">
    <ViewHeading kicker="Practice settings" title="Schedule & availability" text="Publish future booking times and control whether patients can request new appointments." />
    <div className="doctor-schedule-layout"><div>
      <section className="doctor-panel doctor-schedule-builder"><PanelHeading icon={Plus} title="Add appointment time" text="Create a future slot for patients to book." /><div><label className="doctor-form-field"><span>Date</span><input type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="doctor-form-field"><span>Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label><button type="button" onClick={addSlot}><Plus size={17} /> Add slot</button></div>{message && <p className="doctor-inline-error">{message}</p>}</section>
      <section className="doctor-panel doctor-published-schedule"><PanelHeading icon={CalendarDays} title="Published availability" text={`${upcomingDays.length} upcoming ${upcomingDays.length === 1 ? 'date' : 'dates'} available to patients.`} action={expiredCount > 0 && <button type="button" onClick={() => setDraft(Object.fromEntries(upcomingDays))}>Remove {expiredCount} expired</button>} />{upcomingDays.length ? <div>{upcomingDays.map(([day, slots]) => <article key={day}><header><div><span>{formatDate(day, { short: true })}</span><strong>{formatDate(day)}</strong></div><small>{slots.length} {slots.length === 1 ? 'slot' : 'slots'}</small></header><div>{slots.map((slot) => <span key={slot}><Clock3 size={14} />{slot}<button type="button" onClick={() => removeSlot(day, slot)} aria-label={`Remove ${slot}`}><X size={13} /></button></span>)}</div></article>)}</div> : <CompactEmpty icon={CalendarDays} title="No upcoming availability" text="Add a future date and time above, then publish your schedule." />}</section>
    </div><aside>
      <section className={`doctor-panel doctor-booking-status ${isAvailable(doctor) ? 'is-online' : ''}`}><span><Activity size={23} /></span><p>Patient booking status</p><h2>{isAvailable(doctor) ? 'Accepting appointments' : 'New bookings paused'}</h2><small>{isAvailable(doctor) ? 'Patients can see and book your published future slots.' : 'Your profile remains visible, but patients cannot make new bookings.'}</small><button type="button" onClick={onToggleAvailability}><i />{isAvailable(doctor) ? 'Pause new bookings' : 'Start accepting bookings'}</button></section>
      <section className="doctor-panel doctor-schedule-summary"><p>Schedule summary</p><div><span>Upcoming dates<strong>{upcomingDays.length}</strong></span><span>Bookable slots<strong>{upcomingDays.reduce((total, [, slots]) => total + slots.length, 0)}</strong></span><span>Expired dates<strong>{expiredCount}</strong></span></div><button type="button" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}{saving ? 'Publishing...' : 'Publish schedule'}</button></section>
    </aside></div>
  </section>
}

function ProfileView({ doctor, draft, setDraft, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  function change(event) { const { name, value } = event.target; setDraft((current) => ({ ...current, [name]: value })); setError('') }
  async function submit(event) { event.preventDefault(); if (!draft.name.trim()) { setError('Your professional name is required.'); return } setSaving(true); try { await onSave() } catch (saveError) { setError(saveError.message || 'Unable to update profile.') } finally { setSaving(false) } }
  return <section className="doctor-view">
    <ViewHeading kicker="Professional identity" title="Profile settings" text="Keep the information patients see on your public doctor profile accurate and useful." />
    <div className="doctor-profile-layout"><aside className="doctor-panel doctor-profile-preview"><div><ImageWithFallback src={doctor?.imageUrl} alt={doctor?.name} initials={initials(doctor?.name)} /><span className={isAvailable(doctor) ? 'availability-pill availability-pill--available' : 'availability-pill'}><i />{isAvailable(doctor) ? 'Available' : 'Unavailable'}</span></div><p>{draft.specialization || 'Medical professional'}</p><h2>{draft.name || 'Your name'}</h2><small>{draft.location || 'Location not provided'}</small><div><span>Experience<strong>{draft.experience || '—'}</strong></span><span>Consultation<strong>{formatCurrency(draft.fee)}</strong></span></div><Link to={`/doctors/${getId(doctor)}`} target="_blank">View public profile <ArrowRight size={15} /></Link></aside>
      <form className="doctor-panel doctor-profile-form" onSubmit={submit}><PanelHeading icon={Edit3} title="Professional information" text="These details appear in the patient directory." /><div className="doctor-profile-form__grid"><ProfileField label="Display name" name="name" value={draft.name} onChange={change} required /><ProfileField label="Specialization" name="specialization" value={draft.specialization} onChange={change} /><ProfileField label="Experience" name="experience" value={draft.experience} onChange={change} placeholder="e.g. 10 years" /><ProfileField label="Qualifications" name="qualifications" value={draft.qualifications} onChange={change} /><ProfileField label="Practice location" name="location" value={draft.location} onChange={change} /><ProfileField label="Consultation fee" name="fee" type="number" min="0" value={draft.fee} onChange={change} /></div><label className="doctor-form-field"><span>About your practice <small>{draft.about.length}/1200</small></span><textarea name="about" rows="6" maxLength="1200" value={draft.about} onChange={change} placeholder="Describe your expertise and approach to patient care" /></label>{error && <p className="doctor-inline-error"><XCircle size={16} />{error}</p>}<button type="submit" className="doctor-profile-save" disabled={saving}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}{saving ? 'Saving profile...' : 'Save changes'}</button></form>
    </div>
  </section>
}

function StatCard({ icon: Icon, label, value, detail, tone, compact }) { return <article className={`doctor-stat doctor-stat--${tone}`}><span><Icon size={21} /></span><div><p>{label}</p><strong className={compact ? 'is-compact' : ''}>{value}</strong><small>{detail}</small></div></article> }
function PanelHeading({ icon: Icon, title, text, action }) { return <header className="doctor-panel-heading"><span><Icon size={19} /></span><div><h2>{title}</h2><p>{text}</p></div>{action && <div>{action}</div>}</header> }
function ViewHeading({ kicker, title, text }) { return <header className="doctor-view-heading"><div><p>{kicker}</p><h1>{title}</h1><span>{text}</span></div><small><CalendarDays size={15} />{todayLabel()}</small></header> }
function CompactEmpty({ icon: Icon, title, text }) { return <div className="doctor-compact-empty"><span><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></div> }
function Detail({ icon: Icon, label, value }) { return <div><Icon size={17} /><span><small>{label}</small><strong>{value}</strong></span></div> }
function ProfileField({ label, required, ...props }) { return <label className="doctor-form-field"><span>{label}{required && <i>*</i>}</span><input {...props} required={required} /></label> }

function TodayAppointment({ item, onUpdate }) {
  const [working, setWorking] = useState(false)
  async function confirm() { setWorking(true); try { await onUpdate(getId(item), { status: item.status === 'Pending' ? 'Confirmed' : 'Completed' }, item.status === 'Pending' ? 'Appointment confirmed.' : 'Appointment completed.') } finally { setWorking(false) } }
  return <article><span>{formatAppointmentTime(item)}</span><div className="doctor-patient-avatar">{initials(item.patientName)}</div><div><strong>{item.patientName}</strong><small>{item.mobile} · {item.age ? `${item.age} years` : 'Age not provided'}</small></div><i className={statusClass(item.status)}>{item.status}</i>{!['Completed', 'Canceled'].includes(item.status) && <button type="button" onClick={confirm} disabled={working}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}{item.status === 'Pending' ? 'Confirm' : 'Complete'}</button>}</article>
}

function normalizeSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return {}
  return Object.fromEntries(Object.entries(schedule).filter(([, slots]) => Array.isArray(slots)).map(([date, slots]) => [date, [...new Set(slots)].sort(sortTimes)]))
}
function profileFromDoctor(doctor) { return Object.fromEntries(profileFields.map((field) => [field, doctor?.[field] ?? ''])) }
function sortAppointments(first, second) { return `${first.date || ''} ${toTwentyFourHour(first.time)}`.localeCompare(`${second.date || ''} ${toTwentyFourHour(second.time)}`) }
function sortTimes(first, second) { return toTwentyFourHour(first).localeCompare(toTwentyFourHour(second)) }
function initials(value = 'Doctor') { return String(value).split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() }
function toTwelveHour(value = '') { const [rawHour, minute = '00'] = value.split(':'); const number = Number(rawHour); if (!Number.isFinite(number)) return ''; const suffix = number >= 12 ? 'PM' : 'AM'; return `${String(number % 12 || 12).padStart(2, '0')}:${minute} ${suffix}` }
function toTwentyFourHour(value = '') { const match = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i); if (!match) return value.length >= 5 ? value.slice(0, 5) : ''; let hour = Number(match[1]) % 12; if (match[3].toUpperCase() === 'PM') hour += 12; return `${String(hour).padStart(2, '0')}:${match[2]}` }
function todayLabel() { return new Date().toLocaleDateString('en-BD', { weekday: 'long', month: 'long', day: 'numeric' }) }
function dayPeriod() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening' }
function createdLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric' }) }
