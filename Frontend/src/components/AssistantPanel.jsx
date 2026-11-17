import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useUser } from '@clerk/react'
import { CalendarDays, Check, ChevronRight, CircleHelp, LoaderCircle, MessageCircle, RefreshCw, Send, ShieldCheck, Square, Stethoscope, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import DialogPortal from './DialogPortal'
import { assistantApi } from '../lib/assistantApi'
import { patientApi } from '../lib/api'
import { DOCTOR_SESSION_EVENT, readDoctorSession } from '../lib/doctorSession'
import { cleanSchedule, formatCurrency, formatDate, getId, isAvailable } from '../lib/format'
import { patientDetailsError } from '../lib/validation'
import './AssistantPanel.css'

const patientPrompts = ['Find a doctor', 'Book an appointment', 'My appointments']
const doctorPrompts = ['My schedule today', 'Upcoming patients', 'My weekly availability']
const emptyForm = { patientName: '', mobile: '', age: '', gender: '', notes: '', paymentMethod: 'Cash' }

/** Remount the whole conversation whenever the authenticated identity changes. */
export default function AssistantPanel() {
  const { pathname } = useLocation()
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()
  const { user } = useUser()
  const [doctorSession, setDoctorSession] = useState(readDoctorSession)
  const [pendingBooking, setPendingBooking] = useState(null)
  const rememberBooking = useCallback(({ doctorId, date, time }) => setPendingBooking({ doctorId, date, time }), [])
  const consumeBooking = useCallback(() => setPendingBooking(null), [])
  useEffect(() => {
    const update = () => setDoctorSession(readDoctorSession())
    update()
    window.addEventListener(DOCTOR_SESSION_EVENT, update)
    window.addEventListener('storage', update)
    window.addEventListener('focus', update)
    const timer = window.setInterval(update, 30000)
    return () => {
      window.removeEventListener(DOCTOR_SESSION_EVENT, update)
      window.removeEventListener('storage', update)
      window.removeEventListener('focus', update)
      window.clearInterval(timer)
    }
  }, [pathname])

  const doctorMode = pathname.startsWith('/doctor-portal')
  useEffect(() => { if (doctorMode) setPendingBooking(null) }, [doctorMode])
  if (!isLoaded || (doctorMode && !doctorSession?.token) || /^\/(doctor\/login|doctor-admin\/login|patient-login|patient-sign-up|login)(\/|$)/.test(pathname)) return null
  const identity = doctorMode ? `doctor:${doctorSession.token}` : `patient:${isSignedIn ? userId : 'guest'}`
  return <AssistantWorkspace key={identity} doctorMode={doctorMode} doctorSession={doctorSession} isSignedIn={isSignedIn} user={user} getToken={getToken} initialBooking={isSignedIn && !doctorMode ? pendingBooking : null} onBookingHandoff={rememberBooking} onHandoffConsumed={consumeBooking} />
}

function AssistantWorkspace({ doctorMode, doctorSession, isSignedIn, user, getToken, initialBooking, onBookingHandoff, onHandoffConsumed }) {
  const [open, setOpen] = useState(Boolean(initialBooking))
  const [tab, setTab] = useState(initialBooking ? 'booking' : 'chat')
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [bookingDraft, setBookingDraft] = useState(initialBooking)
  const [bookingBusy, setBookingBusy] = useState(false)
  const request = useRef(null)
  const requestVersion = useRef(0)
  const sendLock = useRef(false)
  const lastMessage = useRef(null)
  const inputRef = useRef(null)
  const stopRef = useRef(null)
  const name = doctorSession?.doctor?.name || 'Doctor'
  const doctorName = /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`
  const title = doctorMode ? 'Your clinical assistant' : 'MediCare assistant'

  useEffect(() => { if (initialBooking) onHandoffConsumed() }, [initialBooking, onHandoffConsumed])

  const checkStatus = useCallback(async (signal) => {
    setStatusBusy(true)
    try { setStatus({ ...await assistantApi.status(signal), reachable: true }) }
    catch (statusError) { if (statusError.name !== 'AbortError') setStatus({ available: false, reachable: false, message: statusError.message }) }
    finally { if (!signal?.aborted) setStatusBusy(false) }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    checkStatus(controller.signal)
    return () => controller.abort()
  }, [open, checkStatus])
  useEffect(() => () => { requestVersion.current += 1; request.current?.abort() }, [])
  useEffect(() => {
    lastMessage.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [messages, busy, error, tab, open])
  useEffect(() => {
    if (open && tab === 'chat') (busy ? stopRef.current : inputRef.current)?.focus({ preventScroll: true })
  }, [busy, open, tab])

  function cancel() {
    requestVersion.current += 1
    request.current?.abort()
    request.current = null
    sendLock.current = false
    setBusy(false)
  }
  function close() {
    if (bookingBusy) return
    cancel()
    setOpen(false)
  }
  function startNewChat() {
    if (bookingBusy) return
    cancel()
    setMessages([])
    setConversation(null)
    setBookingDraft(null)
    setInput('')
    setError('')
    setTab('chat')
    inputRef.current?.focus({ preventScroll: true })
  }

  async function send(value = input, displayMessage) {
    const message = value.trim()
    if (!message || sendLock.current) return
    const version = ++requestVersion.current
    const controller = new AbortController()
    request.current = controller
    sendLock.current = true
    const history = recentHistory(messages)
    setMessages((current) => [...current, { role: 'user', content: displayMessage || message, requestContent: message }])
    setInput('')
    setError('')
    setBusy(true)
    try {
      const token = doctorMode ? doctorSession.token : isSignedIn ? await getToken() : undefined
      if ((doctorMode || isSignedIn) && !token) throw new Error('Your session has expired. Sign in again to continue.')
      if (controller.signal.aborted) return
      const answer = await assistantApi.chat({ message, history, conversation }, token, controller.signal)
      if (version !== requestVersion.current) return
      setMessages((current) => [...current, { role: 'assistant', content: answer.reply || 'Please try asking your question another way.', sources: answer.sources, appointments: answer.appointments, suggestions: answer.suggestions }])
      if (Object.hasOwn(answer, 'conversation')) setConversation(answer.conversation)
      if (!doctorMode && Object.hasOwn(answer, 'bookingDraft')) setBookingDraft(answer.bookingDraft || null)
      if (answer.generated === true) setStatus((current) => ({ ...current, available: true, model: answer.model || current?.model }))
    } catch (sendError) {
      if (version !== requestVersion.current || sendError.name === 'AbortError') return
      setError(sendError.message)
      setMessages((current) => current.slice(0, -1))
      setInput(displayMessage ? '' : message)
      if (sendError.status === 503) setStatus((current) => ({ ...current, available: false }))
    } finally {
      if (version === requestVersion.current) {
        sendLock.current = false
        setBusy(false)
        request.current = null
      }
    }
  }

  function prompt(value) {
    send(value)
  }

  return <>
    <button type="button" className={`care-assistant-launcher${doctorMode ? ' care-assistant-launcher--doctor' : ''}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label={doctorMode ? 'Open your clinical assistant' : 'Open MediCare assistant'}>
      <MessageCircle size={21} /><span>{doctorMode ? 'My assistant' : 'Ask MediCare'}</span>
    </button>
    {open && <DialogPortal onClose={close} busy={bookingBusy} label={title}>
      <div className="care-assistant-overlay">
        <button type="button" className="care-assistant-backdrop" data-dialog-backdrop onClick={close} tabIndex={-1} aria-label="Close assistant" />
        <section className="care-assistant" data-dialog-panel data-dialog-drawer>
          <header className="care-assistant-header">
            <span className="care-assistant-mark"><Stethoscope size={23} /></span>
            <div><p>{doctorMode ? doctorName : 'A little help, when you need it'}</p><h2>{title}</h2></div>
            <button type="button" className="care-assistant-icon" onClick={startNewChat} disabled={bookingBusy || (!messages.length && !input && !bookingDraft)} aria-label="Start a new chat" title="Start a new chat"><MessageCircle size={17} /></button>
            <button type="button" className="care-assistant-icon" onClick={close} disabled={bookingBusy} data-dialog-close aria-label="Close assistant"><X size={20} /></button>
          </header>
          <div className="care-assistant-status">
            <span><i className={status?.available ? 'is-online' : ''} />{statusBusy ? 'Checking local assistant…' : status?.available ? 'Local model ready' : status?.reachable ? 'Local language model offline' : 'Assistant connection unavailable'}</span>
            <button type="button" onClick={() => checkStatus()} disabled={statusBusy} aria-label="Check assistant connection"><RefreshCw size={14} className={statusBusy ? 'care-assistant-spin' : ''} /></button>
          </div>
          {!doctorMode && <nav className="care-assistant-tabs" aria-label="Assistant view">
            <button type="button" onClick={() => setTab('chat')} disabled={bookingBusy} aria-current={tab === 'chat' ? 'page' : undefined}><MessageCircle size={16} /> Conversation</button>
            <button type="button" onClick={() => setTab('booking')} disabled={bookingBusy} aria-current={tab === 'booking' ? 'page' : undefined}><CalendarDays size={16} /> Book appointment</button>
          </nav>}
          {tab === 'chat' ? <>
            <div className="care-assistant-conversation">
              <div className="care-assistant-intro">
                <p className="care-assistant-eyebrow">{doctorMode ? 'YOUR DAY, AT A GLANCE' : 'HERE TO HELP'}</p>
                <h3>{doctorMode ? `Good to see you, ${doctorName}.` : 'How can we help you today?'}</h3>
                <p>{doctorMode ? 'What would you like to know about your day? I can check your appointments and help you find a patient’s saved notes.' : 'Tell me what you need. I can help you find a doctor, choose a time or get ready for your visit.'}</p>
                <div className="care-assistant-prompts">{(doctorMode ? doctorPrompts : patientPrompts).map((value) => <button type="button" key={value} onClick={() => prompt(value)} disabled={busy}>{value}<ChevronRight size={14} /></button>)}</div>
              </div>
              {!statusBusy && status?.available === false && <div className="care-assistant-offline"><CircleHelp size={17} /><p>{status.reachable ? doctorMode ? 'The local language model is offline. You can still ask about your schedule and upcoming patients.' : 'The local language model is offline. Doctor search and appointment booking still work.' : 'Unable to reach the assistant. Retry the connection, or use the website to find the information you need.'}</p></div>}
              <div className="care-assistant-messages" role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions text">
                {messages.map((message, index) => <article key={index} className={`care-assistant-message care-assistant-message--${message.role}`}>
                  <span>{message.role === 'user' ? 'You' : 'MediCare assistant'}</span><p>{message.content}</p>
                  {Array.isArray(message.sources) && message.sources.length > 0 && <ul className="care-assistant-sources">{message.sources.filter((source) => safeLink(source.url)).map((source, i) => <li key={i}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title || 'Source'}</a></li>)}</ul>}
                  {doctorMode && Array.isArray(message.appointments) && <AppointmentPreview appointments={message.appointments} busy={busy} onSelect={(appointment) => send(`Show patient details for appointment ${appointment.id || appointment.appointmentId}`, `View saved notes for ${appointment.patientName || 'this patient'}`)} />}
                  {index === messages.length - 1 && message.role === 'assistant' && Array.isArray(message.suggestions) && <div className="care-assistant-suggestions" aria-label="Suggested replies">{message.suggestions.filter((value) => typeof value === 'string' && value.trim()).slice(0, 4).map((value, suggestionIndex) => <button type="button" key={suggestionIndex} disabled={busy} onClick={() => send(value)}>{value}</button>)}</div>}
                </article>)}
                {busy && <p className="care-assistant-thinking"><LoaderCircle size={16} className="care-assistant-spin" /> Checking your question…</p>}
              </div>
              {bookingDraft && !doctorMode && <div className="care-assistant-draft"><CalendarDays size={20} /><div><strong>Review a suggested appointment</strong><p>{bookingDraft.doctorName}<br />{formatDate(bookingDraft.date)} · {bookingDraft.time}</p><button type="button" onClick={() => setTab('booking')}>Review details <ChevronRight size={14} /></button><small>This appointment has not been booked.</small></div></div>}
              {error && <p className="care-assistant-error" role="alert">{error}</p>}
              <div ref={lastMessage} />
            </div>
            <form className="care-assistant-composer" onSubmit={(event) => { event.preventDefault(); send() }}>
              <label className="care-assistant-sr-only" htmlFor="care-assistant-input">Message MediCare assistant</label>
              <textarea id="care-assistant-input" ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={doctorMode ? 'Ask about your day…' : 'Ask a question…'} rows={2} maxLength={2000} disabled={busy} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }} />
              {busy ? <button type="button" ref={stopRef} className="care-assistant-send" onClick={cancel} aria-label="Stop assistant response"><Square size={16} /></button> : <button type="submit" className="care-assistant-send" disabled={!input.trim()} aria-label="Send message"><Send size={18} /></button>}
            </form>
          </> : <BookingPane draft={bookingDraft} isSignedIn={isSignedIn} user={user} getToken={getToken} onBusy={setBookingBusy} onClose={close} onBookingHandoff={onBookingHandoff} onDraftConsumed={() => { setBookingDraft(null); setConversation(null) }} />}
          <footer className="care-assistant-note"><ShieldCheck size={14} /><p>{doctorMode ? 'Verify AI summaries against the patient record before clinical decisions.' : 'AI can make mistakes. Confirm medical advice with your clinician. This is not emergency care.'}</p></footer>
        </section>
      </div>
    </DialogPortal>}
  </>
}

function AppointmentPreview({ appointments, busy, onSelect }) {
  const available = appointments.filter((appointment) => appointment && (appointment.id || appointment.appointmentId))
  if (!available.length) return null
  const renderAppointment = (appointment) => <div className="care-assistant-patient" key={appointment.id || appointment.appointmentId}>
    <strong>{appointment.patientName || 'Patient'}</strong><small>{formatDate(appointment.date)} · {appointment.time}</small>
    <button type="button" disabled={busy} onClick={() => onSelect(appointment)} aria-label={`View saved notes for ${appointment.patientName || 'this patient'}`}>View saved notes <ChevronRight size={13} /></button>
  </div>
  return <div className="care-assistant-patients">
    {available.slice(0, 3).map(renderAppointment)}
    {available.length > 3 && <details className="care-assistant-more-patients"><summary>See {available.length - 3} more appointments</summary><div>{available.slice(3).map(renderAppointment)}</div></details>}
  </div>
}

function BookingPane({ draft, isSignedIn, user, getToken, onBusy, onClose, onBookingHandoff, onDraftConsumed }) {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState(draft?.doctorId || '')
  const [doctor, setDoctor] = useState(null)
  const [date, setDate] = useState(draft?.date || '')
  const [time, setTime] = useState(draft?.time || '')
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const [form, setForm] = useState(() => ({ ...emptyForm, patientName: user?.fullName || '', mobile: user?.primaryPhoneNumber?.phoneNumber || '' }))
  const lock = useRef(false)
  const active = useRef(true)
  const horizonDays = draft ? 90 : 28
  const schedule = useMemo(() => bookingSchedule(doctor, horizonDays), [doctor, horizonDays])
  const slots = schedule.find((day) => day.date === date)?.slots || []

  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    if (!draft) return
    setDoctorId(draft.doctorId || '')
    setDate(draft.date || '')
    setTime(draft.time || '')
  }, [draft])
  useEffect(() => {
    if (!user) return
    setForm((current) => ({ ...current, patientName: current.patientName || user.fullName || '', mobile: current.mobile || user.primaryPhoneNumber?.phoneNumber || '' }))
  }, [user])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    patientApi.getAllDoctors().then((items) => {
      if (!cancelled) setDoctors(items.filter(isAvailable))
    }).catch((loadError) => { if (!cancelled) setError(loadError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [reload])

  useEffect(() => {
    if (!doctorId) { setDoctor(null); return undefined }
    let cancelled = false
    setProfileLoading(true)
    setDoctor(null)
    setError('')
    patientApi.getDoctor(doctorId).then((profile) => {
      if (cancelled) return
      setDoctor(profile)
      const days = bookingSchedule(profile, horizonDays)
      setDate((current) => days.some((day) => day.date === current) ? current : '')
      setTime((current) => draft?.doctorId === doctorId && days.some((day) => day.date === draft.date && day.slots.includes(current)) ? current : '')
    }).catch((loadError) => { if (!cancelled) setError(loadError.message) })
      .finally(() => { if (!cancelled) setProfileLoading(false) })
    return () => { cancelled = true }
  }, [doctorId, reload, draft, horizonDays])

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }
  async function book(event) {
    event.preventDefault()
    if (lock.current) return
    if (!isSignedIn) {
      onBookingHandoff({ doctorId, date, time })
      onClose()
      navigate('/patient-login')
      return
    }
    const currentSchedule = bookingSchedule(doctor, horizonDays)
    if (!doctor || !isAvailable(doctor) || !currentSchedule.some((day) => day.date === date && day.slots.includes(time))) {
      setError('Choose an available doctor, date and time before confirming.')
      return
    }
    const validationError = patientDetailsError(form)
    if (validationError) { setError(validationError); return }
    lock.current = true
    setSaving(true)
    onBusy(true)
    setError('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Your session has expired. Please sign in again to book.')
      if (!active.current) return
      const payload = await patientApi.createAppointment({
        doctorId: getId(doctor), patientName: form.patientName.trim(), mobile: form.mobile.trim(),
        age: form.age === '' ? undefined : Number(form.age), gender: form.gender, notes: form.notes.trim(),
        email: user?.primaryEmailAddress?.emailAddress || undefined,
        date, time, fee: Number(doctor.fee || 0), paymentMethod: Number(doctor.fee || 0) === 0 ? 'Cash' : form.paymentMethod,
      }, token)
      if (!active.current) return
      if (payload.checkoutUrl) { window.location.assign(payload.checkoutUrl); return }
      setSuccess(`Appointment booked with ${doctor.name} for ${formatDate(date)} at ${time}.`)
      onDraftConsumed()
      setDate('')
      setTime('')
    } catch (bookingError) {
      if (!active.current) return
      setError(bookingError.message || 'Unable to complete this booking.')
      if (bookingError.status === 409) {
        setTime('')
        try { const profile = await patientApi.getDoctor(doctorId); if (active.current) setDoctor(profile) } catch { /* Keep the original booking error. */ }
      }
    } finally {
      lock.current = false
      if (active.current) { setSaving(false); onBusy(false) }
    }
  }

  return <div className="care-assistant-booking">
    <div className="care-assistant-booking-heading"><p className="care-assistant-eyebrow">YOUR NEXT VISIT</p><h3>Make time for your health.</h3><p>Choose from live appointment availability. Booking happens only after you confirm.</p></div>
    {success ? <div className="care-assistant-success" role="status"><Check size={24} /><h3>You’re booked.</h3><p>{success}</p><Link to="/appointments" onClick={onClose}>View my appointments <ChevronRight size={15} /></Link><button type="button" onClick={() => { setSuccess(''); setReload((value) => value + 1) }}>Book another visit</button></div> : <form onSubmit={book} noValidate>
      <fieldset disabled={saving}>
        <label className="care-assistant-field"><span>Doctor</span><select value={doctorId} onChange={(event) => { setDoctorId(event.target.value); setDate(''); setTime(''); setError('') }} disabled={loading || saving}><option value="">{loading ? 'Loading doctors…' : 'Choose a doctor'}</option>{doctors.map((item) => <option value={getId(item)} key={getId(item)}>{item.name} — {item.specialization || 'General medicine'}</option>)}</select></label>
        {!loading && !doctors.length && !error && <p className="care-assistant-empty">No doctors are currently available. Please check again later.</p>}
        {profileLoading && <p className="care-assistant-thinking" role="status"><LoaderCircle size={16} className="care-assistant-spin" /> Checking available times…</p>}
        {doctor && !profileLoading && <>
          <div className="care-assistant-field-row"><label className="care-assistant-field"><span>Date</span><select value={date} onChange={(event) => { setDate(event.target.value); setTime(''); setError('') }}><option value="">Choose a date</option>{schedule.map((day) => <option key={day.date} value={day.date}>{formatDate(day.date, { short: true })}</option>)}</select></label><label className="care-assistant-field"><span>Time</span><select value={time} onChange={(event) => { setTime(event.target.value); setError('') }} disabled={!date || saving}><option value="">Choose a time</option>{slots.map((slot) => <option key={slot}>{slot}</option>)}</select></label></div>
          {!schedule.length && <p className="care-assistant-empty">No available appointments in the next {horizonDays} days. Please choose another doctor.</p>}
          <p className="care-assistant-timezone">Appointment times follow the clinic’s schedule in Bangladesh.</p>
        </>}
        {date && time && doctor && !profileLoading && <>
          <div className="care-assistant-booking-review"><strong>{doctor?.name}</strong><span>{formatDate(date)} · {time}</span><span>Consultation: {formatCurrency(doctor?.fee, 'BDT')}</span></div>
          {!isSignedIn ? <p className="care-assistant-empty">Sign in with your patient account to enter your details. We’ll recheck your selected time when you return, before you confirm.</p> : <>
            <label className="care-assistant-field"><span>Patient name <small>Required</small></span><input name="patientName" value={form.patientName} onChange={change} maxLength={100} autoComplete="name" required /></label>
            <label className="care-assistant-field"><span>Mobile number <small>Required</small></span><input name="mobile" type="tel" value={form.mobile} onChange={change} maxLength={25} autoComplete="tel" placeholder="01XXXXXXXXX" required /></label>
            <div className="care-assistant-field-row"><label className="care-assistant-field"><span>Age <small>Optional</small></span><input name="age" type="number" min="0" max="120" step="1" value={form.age} onChange={change} /></label><label className="care-assistant-field"><span>Gender</span><select name="gender" value={form.gender} onChange={change}><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option></select></label></div>
            <label className="care-assistant-field"><span>Notes for your doctor <small>Optional</small></span><textarea name="notes" value={form.notes} onChange={change} rows={3} maxLength={500} /></label>
            {Number(doctor?.fee || 0) > 0 && <label className="care-assistant-field"><span>Payment method</span><select name="paymentMethod" value={form.paymentMethod} onChange={change}><option value="Cash">Pay at appointment</option><option value="Online">Pay securely online</option></select></label>}
          </>}
          <button type="submit" className="care-assistant-confirm" disabled={saving || profileLoading}>{saving ? <LoaderCircle size={17} className="care-assistant-spin" /> : <CalendarDays size={17} />}{saving ? 'Confirming appointment…' : isSignedIn ? 'Confirm appointment' : 'Sign in to book'}</button>
        </>}
      </fieldset>
      {error && <div className="care-assistant-error" role="alert"><p>{error}</p>{!saving && <button type="button" onClick={() => setReload((value) => value + 1)}><RefreshCw size={14} /> Refresh availability</button>}</div>}
    </form>}
  </div>
}

function safeLink(value) {
  return typeof value === 'string' && (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value))
}

function recentHistory(messages) {
  const history = []
  let budget = 6000
  for (const message of messages.slice(-8).reverse()) {
    const content = String(message.requestContent || message.content).slice(0, Math.min(2000, budget))
    if (!content) break
    history.unshift({ role: message.role, content })
    budget -= content.length
  }
  return history
}

function bookingSchedule(doctor, horizonDays) {
  if (!isAvailable(doctor)) return []
  // cleanSchedule accepts a local wall clock; use the clinic's clock even abroad.
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  const now = new Date(values.year, values.month - 1, values.day, values.hour, values.minute, values.second)
  return cleanSchedule(doctor.schedule, { bookedSlots: doctor.bookedSlots, horizonDays, now })
}
