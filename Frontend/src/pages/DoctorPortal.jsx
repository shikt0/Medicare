import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowRight, Banknote, Bell, CalendarCheck, CalendarDays, Check, CheckCircle2,
  Camera, ChevronRight, CircleUserRound, ClipboardList, Clock3, Edit3, LayoutDashboard, LoaderCircle,
  LogOut, Menu, MessageSquareText, Phone, Plus, RefreshCw, Save, Search, ShieldCheck, FlaskConical,
  Sparkles, UserRound, UsersRound, X, XCircle,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import { ErrorState, ImageWithFallback, LoadingPanel } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { clearDoctorSession, readDoctorSession, saveDoctorSession } from '../lib/doctorSession'
import { formatAppointmentTime, formatCurrency, formatDate, getId, isAvailable, localDateKey, normalizeWeeklySchedule, statusClass, WEEK_DAYS } from '../lib/format'
import '../doctorPortal.css'

const navItems = [
  { label: 'Overview', path: '/doctor-portal', icon: LayoutDashboard, end: true },
  { label: 'Appointments', path: '/doctor-portal/appointments', icon: ClipboardList },
  { label: 'Laboratory', path: '/doctor-portal/laboratory', icon: FlaskConical },
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
  const [labTests, setLabTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cashPrompt, setCashPrompt] = useState(null)
  const [cashPromptBusy, setCashPromptBusy] = useState(false)
  const [scheduleDraft, setScheduleDraft] = useState(() => normalizeWeeklySchedule(session?.doctor?.schedule))
  const [profileDraft, setProfileDraft] = useState(() => profileFromDoctor(session?.doctor))

  const logout = useCallback(() => {
    clearDoctorSession()
    setSession(null)
    navigate('/doctor/login', { replace: true })
  }, [navigate])

  const loadWorkspace = useCallback(async (refresh = false) => {
    if (!session?.token) return
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [profile, appointmentPayload, laboratory] = await Promise.all([
        patientApi.getDoctorPortalMe(session.token),
        patientApi.getDoctorPortalAppointments(session.token, { limit: 200 }),
        patientApi.getDoctorLabTests(session.token, { limit: 200 }),
      ])
      setDoctor(profile)
      setAppointments(appointmentPayload.appointments || [])
      setLabTests(laboratory)
      setScheduleDraft(normalizeWeeklySchedule(profile.schedule))
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
      navigate('/doctor/login', { replace: true })
      return undefined
    }
    const timeout = window.setTimeout(() => loadWorkspace(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadWorkspace, navigate, session?.token])

  useEffect(() => setMenuOpen(false), [location.pathname])

  function syncDoctor(nextDoctor) {
    setDoctor(nextDoctor)
    setScheduleDraft(normalizeWeeklySchedule(nextDoctor.schedule))
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

  async function saveAppointmentUpdate(id, changes, successMessage) {
    const updated = await patientApi.updateDoctorPortalAppointment(id, changes, session.token)
    setAppointments((current) => current.map((item) => getId(item) === getId(updated) ? updated : item))
    setNotice({ tone: 'success', text: successMessage || 'Appointment updated.' })
    return updated
  }

  function updateAppointment(id, changes, successMessage) {
    const appointment = appointments.find((item) => String(getId(item)) === String(id))
    if (changes?.status === 'Completed' && requiresCashPaymentDecision(appointment) && typeof changes.cashPaymentReceived !== 'boolean') {
      return new Promise((resolve, reject) => {
        setCashPrompt({ appointment, changes, successMessage, resolve, reject })
      })
    }
    return saveAppointmentUpdate(id, changes, successMessage)
  }

  function closeCashPrompt() {
    if (cashPromptBusy) return
    cashPrompt?.resolve({ cancelled: true })
    setCashPrompt(null)
  }

  async function confirmCashCompletion(cashPaymentReceived) {
    if (!cashPrompt) return
    const prompt = cashPrompt
    setCashPromptBusy(true)
    try {
      const updated = await saveAppointmentUpdate(
        getId(prompt.appointment),
        { ...prompt.changes, cashPaymentReceived },
        prompt.successMessage,
      )
      prompt.resolve(updated)
    } catch (completionError) {
      prompt.reject(completionError)
    } finally {
      setCashPromptBusy(false)
      setCashPrompt(null)
    }
  }

  async function saveSchedule() {
    const updated = await patientApi.updateDoctorProfile(getId(doctor), { schedule: scheduleDraft }, session.token)
    syncDoctor(updated)
    setNotice({ tone: 'success', text: 'Your recurring weekly schedule has been published.' })
  }

  async function saveProfile(imageFile) {
    let body = { ...profileDraft, fee: Number(profileDraft.fee || 0) }
    if (imageFile) {
      body = new FormData()
      profileFields.forEach((field) => body.append(field, field === 'fee' ? String(Number(profileDraft.fee || 0)) : profileDraft[field] || ''))
      body.append('image', imageFile)
    }
    const updated = await patientApi.updateDoctorProfile(getId(doctor), body, session.token)
    syncDoctor(updated)
    setNotice({ tone: 'success', text: 'Your professional profile has been updated.' })
    return updated
  }

  async function orderLabTest(body) {
    const created = await patientApi.createLabTest(body, session.token)
    setLabTests((current) => [created, ...current])
    setNotice({ tone: 'success', text: 'Laboratory test ordered for the patient.' })
    return created
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
          ) : section === 'laboratory' ? (
            <LaboratoryView appointments={appointments} tests={labTests} onOrder={orderLabTest} />
          ) : section === 'schedule' ? (
            <ScheduleView doctor={doctor} draft={scheduleDraft} setDraft={setScheduleDraft} onSave={saveSchedule} onToggleAvailability={toggleAvailability} />
          ) : section === 'profile' ? (
            <ProfileView doctor={doctor} draft={profileDraft} setDraft={setProfileDraft} onSave={saveProfile} />
          ) : (
            <OverviewView doctor={doctor} appointments={appointments} onUpdate={updateAppointment} />
          )}
        </main>
      </div>
      {cashPrompt && (
        <CashPaymentModal
          key={getId(cashPrompt.appointment)}
          appointment={cashPrompt.appointment}
          busy={cashPromptBusy}
          onClose={closeCashPrompt}
          onConfirm={confirmCashCompletion}
        />
      )}
    </div>
  )
}

function OverviewView({ doctor, appointments, onUpdate }) {
  const today = localDateKey(new Date())
  const todaysAppointments = appointments.filter((item) => item.date === today && item.status !== 'Canceled')
  const upcoming = appointments.filter((item) => item.date >= today && !['Completed', 'Canceled'].includes(item.status))
  const completed = appointments.filter((item) => item.status === 'Completed')
  const paidTotal = appointments.filter((item) => item.status === 'Completed' && item.payment?.status === 'Paid').reduce((total, item) => total + Number(item.fees || 0), 0)
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
      <StatCard icon={Banknote} label="Visit revenue" value={formatCurrency(paidTotal)} detail="Completed and paid" tone="amber" compact />
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
    try { const result = await onUpdate(getId(item), changes, message); if (changes.status && !result?.cancelled) onClose() }
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

function CashPaymentModal({ appointment, busy, onClose, onConfirm }) {
  const [cashPaymentReceived, setCashPaymentReceived] = useState(null)

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="doctor-cash-payment-title">
      <button type="button" onClick={onClose} disabled={busy} aria-label="Close cash payment confirmation" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm disabled:cursor-wait" />
      <section className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Banknote size={21} /></span>
        <h2 id="doctor-cash-payment-title" className="mt-4 text-xl font-bold text-slate-950">Confirm cash payment</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Before completing {appointment.patientName}’s visit, confirm whether the consultation fee was received in cash.</p>
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><strong className="text-slate-900">{formatCurrency(appointment.fees)}</strong> consultation fee</div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={cashPaymentReceived === true} onClick={() => setCashPaymentReceived(true)} disabled={busy} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${cashPaymentReceived === true ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-200 text-slate-700 hover:border-emerald-300'}`}>Yes, received</button>
          <button type="button" aria-pressed={cashPaymentReceived === false} onClick={() => setCashPaymentReceived(false)} disabled={busy} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${cashPaymentReceived === false ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-100' : 'border-slate-200 text-slate-700 hover:border-amber-300'}`}>No, unpaid</button>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">Unpaid visits can still be completed, but they will not be added to admin revenue.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Go back</button>
          <button type="button" onClick={() => onConfirm(cashPaymentReceived)} disabled={busy || cashPaymentReceived === null} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{busy && <LoaderCircle size={16} className="animate-spin" />}{busy ? 'Saving...' : 'Complete visit'}</button>
        </div>
      </section>
    </div>
  )
}

function LaboratoryView({ appointments, tests, onOrder }) {
  const eligibleAppointments = appointments.filter((item) => item.createdBy && item.status !== 'Canceled')
  const [form, setForm] = useState({ appointmentId: '', testName: '', testCategory: 'Hematology', sampleType: 'Blood', priority: 'normal', clinicalNote: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('All')
  const visible = tests.filter((item) => status === 'All' || item.status === status)
  function update(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setError('') }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try { await onOrder(form); setForm((current) => ({ ...current, appointmentId: '', testName: '', clinicalNote: '' })) } catch (orderError) { setError(orderError.message || 'Unable to order the laboratory test.') } finally { setSaving(false) }
  }
  return <section className="doctor-view"><ViewHeading kicker="Connected diagnostics" title="Laboratory" text="Order tests from an existing patient appointment and follow results through the laboratory workflow." /><div className="doctor-lab-layout"><form className="doctor-panel doctor-lab-order" onSubmit={submit}><PanelHeading icon={FlaskConical} title="New test order" text="Patient identity is securely copied from the selected appointment." /><div className="doctor-lab-form"><label className="doctor-form-field doctor-lab-span"><span>Patient appointment <i>*</i></span><select name="appointmentId" value={form.appointmentId} onChange={update} required><option value="">Choose patient appointment</option>{eligibleAppointments.map((item) => <option key={getId(item)} value={getId(item)}>{item.patientName} · {item.date} {item.time}</option>)}</select></label><ProfileField label="Test name" name="testName" value={form.testName} onChange={update} required placeholder="e.g. Complete Blood Count" /><label className="doctor-form-field"><span>Category</span><select name="testCategory" value={form.testCategory} onChange={update}>{['Hematology','Biochemistry','Microbiology','Immunology','Pathology','Other'].map((item) => <option key={item}>{item}</option>)}</select></label><ProfileField label="Sample type" name="sampleType" value={form.sampleType} onChange={update} required /><label className="doctor-form-field"><span>Priority</span><select name="priority" value={form.priority} onChange={update}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></label><label className="doctor-form-field doctor-lab-span"><span>Clinical note <small>{form.clinicalNote.length}/1500</small></span><textarea name="clinicalNote" value={form.clinicalNote} onChange={update} rows="4" maxLength="1500" placeholder="Reason for test and relevant clinical context" /></label>{error && <p className="doctor-inline-error doctor-lab-span"><XCircle size={16} />{error}</p>}<button disabled={saving || !eligibleAppointments.length} className="doctor-profile-save doctor-lab-span">{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />}{saving ? 'Ordering...' : 'Order laboratory test'}</button>{!eligibleAppointments.length && <p className="doctor-lab-help doctor-lab-span">A patient appointment linked to a secure patient account is required before ordering a test.</p>}</div></form><div className="doctor-panel doctor-lab-history"><PanelHeading icon={ClipboardList} title="Test orders" text={`${tests.length} orders in your practice history.`} /><div className="doctor-lab-filters">{['All','ordered','sample-collected','processing','completed','cancelled'].map((value) => <button type="button" key={value} onClick={() => setStatus(value)} className={status === value ? 'is-active' : ''}>{prettyStatus(value)}</button>)}</div>{visible.length ? <div className="doctor-lab-list">{visible.map((item) => <article key={item._id}><div><span>{item.testCategory || item.sampleType}</span><h3>{item.testName}</h3><p>{item.patientName} · {new Date(item.orderedAt).toLocaleDateString()}</p></div><div><span className={`doctor-lab-priority doctor-lab-priority--${item.priority}`}>{prettyStatus(item.priority)}</span><span className="doctor-lab-status">{prettyStatus(item.status)}</span></div>{item.result && <p className="doctor-lab-result"><strong>Result:</strong> {item.result}</p>}</article>)}</div> : <CompactEmpty icon={FlaskConical} title="No test orders in this view" text="New laboratory orders and results will appear here." />}</div></div></section>
}

function ScheduleView({ doctor, draft, setDraft, onSave, onToggleAvailability }) {
  const [day, setDay] = useState(() => ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()])
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const publishedDays = WEEK_DAYS.map((item) => ({ ...item, slots: draft[item.key] || [] }))
  const scheduledDays = publishedDays.filter((item) => item.slots.length)
  const totalSlots = scheduledDays.reduce((total, item) => total + item.slots.length, 0)

  function addSlot() {
    if (!day || !time) { setMessage('Choose both a weekday and time.'); return }
    const value = toTwelveHour(time)
    if ((draft[day] || []).includes(value)) { setMessage('That time is already scheduled for this weekday.'); return }
    setDraft((current) => ({ ...current, [day]: [...new Set([...(current[day] || []), value])].sort(sortTimes) }))
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

  function clearDay(dayKey) {
    setDraft((current) => {
      const next = { ...current }
      delete next[dayKey]
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
    <ViewHeading kicker="Practice settings" title="Weekly schedule & availability" text="Set each weekday once. The same timetable repeats automatically every week." />
    <div className="doctor-schedule-layout"><div>
      <section className="doctor-panel doctor-schedule-builder"><PanelHeading icon={Plus} title="Add recurring appointment time" text="Choose a weekday and time. It will repeat every week until you remove it." /><div><label className="doctor-form-field"><span>Weekday</span><select value={day} onChange={(event) => { setDay(event.target.value); setMessage('') }}>{WEEK_DAYS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="doctor-form-field"><span>Time</span><input type="time" value={time} onChange={(event) => { setTime(event.target.value); setMessage('') }} /></label><button type="button" onClick={addSlot}><Plus size={17} /> Add weekly slot</button></div>{message && <p className="doctor-inline-error">{message}</p>}</section>
      <section className="doctor-panel doctor-published-schedule"><PanelHeading icon={CalendarDays} title="Recurring weekly timetable" text={`${scheduledDays.length} working ${scheduledDays.length === 1 ? 'day' : 'days'} and ${totalSlots} appointment ${totalSlots === 1 ? 'time' : 'times'} each week.`} /><div>{publishedDays.map(({ key, label, slots }) => <article key={key} className={slots.length ? '' : 'is-empty'}><header><div><span>Every week</span><strong>{label}</strong></div><div className="doctor-day-actions"><small>{slots.length ? `${slots.length} ${slots.length === 1 ? 'slot' : 'slots'}` : 'Not scheduled'}</small>{slots.length > 0 && <button type="button" onClick={() => clearDay(key)}>Cancel day</button>}</div></header>{slots.length > 0 ? <div>{slots.map((slot) => <span key={slot}><Clock3 size={14} />{slot}<button type="button" onClick={() => removeSlot(key, slot)} aria-label={`Cancel ${slot} every ${label}`}><X size={13} /></button></span>)}</div> : <p className="doctor-day-off">No recurring appointments</p>}</article>)}</div></section>
    </div><aside>
      <section className={`doctor-panel doctor-booking-status ${isAvailable(doctor) ? 'is-online' : ''}`}><span><Activity size={23} /></span><p>Patient booking status</p><h2>{isAvailable(doctor) ? 'Accepting appointments' : 'New bookings paused'}</h2><small>{isAvailable(doctor) ? 'Patients can book the published weekly timetable on future matching dates.' : 'Your profile remains visible, but patients cannot make new bookings.'}</small><button type="button" onClick={onToggleAvailability}><i />{isAvailable(doctor) ? 'Pause new bookings' : 'Start accepting bookings'}</button></section>
      <section className="doctor-panel doctor-schedule-summary"><p>Weekly schedule summary</p><div><span>Scheduled days<strong>{scheduledDays.length}</strong></span><span>Weekly time slots<strong>{totalSlots}</strong></span><span>Repeats<strong>Every week</strong></span></div><button type="button" onClick={save} disabled={saving}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}{saving ? 'Publishing...' : 'Publish weekly schedule'}</button></section>
    </aside></div>
  </section>
}

function ProfileView({ doctor, draft, setDraft, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const imageInputRef = useRef(null)
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : doctor?.imageUrl, [doctor?.imageUrl, imageFile])

  useEffect(() => {
    if (!imageFile) return undefined
    return () => URL.revokeObjectURL(imagePreview)
  }, [imageFile, imagePreview])

  function change(event) { const { name, value } = event.target; setDraft((current) => ({ ...current, [name]: value })); setError('') }
  function selectImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile picture must be 5 MB or smaller.')
      event.target.value = ''
      return
    }
    setImageFile(file)
    setError('')
  }
  function clearSelectedImage() {
    setImageFile(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }
  async function submit(event) {
    event.preventDefault()
    if (!draft.name.trim()) { setError('Your professional name is required.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(imageFile)
      clearSelectedImage()
    } catch (saveError) {
      setError(saveError.message || 'Unable to update profile.')
    } finally {
      setSaving(false)
    }
  }
  return <section className="doctor-view">
    <ViewHeading kicker="Professional identity" title="Profile settings" text="Keep the information patients see on your public doctor profile accurate and useful." />
    <div className="doctor-profile-layout"><aside className="doctor-panel doctor-profile-preview"><div><ImageWithFallback key={imagePreview || 'profile-preview'} src={imagePreview} alt={draft.name || doctor?.name} initials={initials(draft.name || doctor?.name)} /><span className={isAvailable(doctor) ? 'availability-pill availability-pill--available' : 'availability-pill'}><i />{isAvailable(doctor) ? 'Available' : 'Unavailable'}</span></div><p>{draft.specialization || 'Medical professional'}</p><h2>{draft.name || 'Your name'}</h2><small>{draft.location || 'Location not provided'}</small><div><span>Experience<strong>{draft.experience || '—'}</strong></span><span>Consultation<strong>{formatCurrency(draft.fee)}</strong></span></div><Link to={`/doctors/${getId(doctor)}`} target="_blank">View public profile <ArrowRight size={15} /></Link></aside>
      <form className="doctor-panel doctor-profile-form" onSubmit={submit}><PanelHeading icon={Edit3} title="Professional information" text="These details appear in the patient directory." /><div className="doctor-profile-photo"><ImageWithFallback key={imagePreview || 'profile-photo'} src={imagePreview} alt={draft.name || doctor?.name} initials={initials(draft.name || doctor?.name)} /><div><strong>Profile picture</strong><p>Upload a JPG, PNG, or WebP image up to 5 MB.</p><span><label><Camera size={16} />{imageFile ? 'Choose another' : 'Choose photo'}<input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /></label>{imageFile && <button type="button" onClick={clearSelectedImage}>Remove selection</button>}</span>{imageFile && <small>{imageFile.name}</small>}</div></div><div className="doctor-profile-form__grid"><ProfileField label="Display name" name="name" value={draft.name} onChange={change} required /><ProfileField label="Specialization" name="specialization" value={draft.specialization} onChange={change} /><ProfileField label="Experience" name="experience" value={draft.experience} onChange={change} placeholder="e.g. 10 years" /><ProfileField label="Qualifications" name="qualifications" value={draft.qualifications} onChange={change} /><ProfileField label="Practice location" name="location" value={draft.location} onChange={change} /><ProfileField label="Consultation fee" name="fee" type="number" min="0" value={draft.fee} onChange={change} /></div><label className="doctor-form-field"><span>About your practice <small>{draft.about.length}/1200</small></span><textarea name="about" rows="6" maxLength="1200" value={draft.about} onChange={change} placeholder="Describe your expertise and approach to patient care" /></label>{error && <p className="doctor-inline-error"><XCircle size={16} />{error}</p>}<button type="submit" className="doctor-profile-save" disabled={saving}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}{saving ? 'Saving profile...' : 'Save changes'}</button></form>
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

function profileFromDoctor(doctor) { return Object.fromEntries(profileFields.map((field) => [field, doctor?.[field] ?? ''])) }
function sortAppointments(first, second) { return `${first.date || ''} ${toTwentyFourHour(first.time)}`.localeCompare(`${second.date || ''} ${toTwentyFourHour(second.time)}`) }
function sortTimes(first, second) { return toTwentyFourHour(first).localeCompare(toTwentyFourHour(second)) }
function initials(value = 'Doctor') { return String(value).split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() }
function prettyStatus(value) { return String(value || '').split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ') }
function toTwelveHour(value = '') { const [rawHour, minute = '00'] = value.split(':'); const number = Number(rawHour); if (!Number.isFinite(number)) return ''; const suffix = number >= 12 ? 'PM' : 'AM'; return `${String(number % 12 || 12).padStart(2, '0')}:${minute} ${suffix}` }
function toTwentyFourHour(value = '') { const match = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i); if (!match) return value.length >= 5 ? value.slice(0, 5) : ''; let hour = Number(match[1]) % 12; if (match[3].toUpperCase() === 'PM') hour += 12; return `${String(hour).padStart(2, '0')}:${match[2]}` }
function todayLabel() { return new Date().toLocaleDateString('en-BD', { weekday: 'long', month: 'long', day: 'numeric' }) }
function dayPeriod() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening' }
function createdLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'recently' : date.toLocaleDateString('en-BD', { month: 'short', day: 'numeric', year: 'numeric' }) }
function requiresCashPaymentDecision(appointment) { return appointment?.payment?.method === 'Cash' && appointment?.payment?.status !== 'Paid' && Number(appointment?.fees ?? appointment?.payment?.amount ?? 0) > 0 }
