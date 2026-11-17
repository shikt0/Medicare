import { useEffect, useState } from 'react'
import { useAuth, useClerk } from '@clerk/react'
import { ArrowRight, CheckCircle2, CreditCard, LoaderCircle, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { patientApi } from '../lib/api'
import { confirmedPaymentState } from '../lib/payment'

export default function PaymentResult({ kind = 'doctor', outcome = 'success' }) {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const clerk = useClerk()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(outcome === 'success' ? 'loading' : 'canceled')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    setMessage('')
    if (outcome !== 'success') {
      setState('canceled')
      return undefined
    }
    setState('loading')
    if (!isLoaded) return undefined
    if (!isSignedIn) {
      setState('signin')
      return undefined
    }
    if (!sessionId) {
      setState('error')
      setMessage('The payment session is missing. Review your appointments for the latest status.')
      return
    }

    const confirm = kind === 'service' ? patientApi.confirmServicePayment : patientApi.confirmAppointmentPayment
    getToken().then((token) => {
      if (!token) throw new Error('Your session has expired. Sign in again to confirm your payment.')
      return confirm(sessionId, token)
    })
      .then((payload) => { if (active) setState(confirmedPaymentState(payload.appointment || payload.data)) })
      .catch((error) => {
        if (!active) return
        setState('error')
        setMessage(error.message || 'We could not confirm the payment.')
      })
    return () => { active = false }
  }, [attempt, getToken, isLoaded, isSignedIn, kind, outcome, sessionId])

  const content = getContent(state, kind, message)
  const StateIcon = content.icon

  return (
    <div className="patient-site">
      <Navbar />
      <main className="payment-result-page">
        <section className={`payment-result-card payment-result-card--${state}`}>
          <span className="payment-result-card__icon">{state === 'loading' ? <LoaderCircle size={30} className="animate-spin" /> : <StateIcon size={30} />}</span>
          <p>{content.kicker}</p>
          <h1>{content.title}</h1>
          <span>{content.description}</span>
          {state === 'signin' && <button type="button" className="patient-submit-button" onClick={() => clerk.openSignIn()}>Sign in to confirm payment</button>}
          {state === 'error' && sessionId && <button type="button" className="patient-submit-button" onClick={() => setAttempt((current) => current + 1)}>Try confirmation again</button>}
          <div><Link to="/appointments" className="premium-button premium-button--primary">View appointments <ArrowRight size={16} /></Link><Link to={kind === 'service' ? '/services' : '/doctors'} className="premium-button premium-button--secondary">Continue browsing</Link></div>
          <small><CreditCard size={14} /> Payment details are reflected in your appointment record.</small>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function getContent(state, kind, message) {
  const booking = kind === 'service' ? 'service booking' : 'doctor appointment'
  if (state === 'loading') return { icon: LoaderCircle, kicker: 'Confirming payment', title: 'Just a moment...', description: `We are securely confirming your ${booking}.` }
  if (state === 'signin') return { icon: CreditCard, kicker: 'Secure payment confirmation', title: 'Sign in to confirm your booking.', description: 'Use the patient account you used at checkout to view your payment status.' }
  if (state === 'success') return { icon: CheckCircle2, kicker: 'Payment confirmed', title: 'Your booking is confirmed.', description: `Payment for your ${booking} was successful. You can review the full details in your appointments.` }
  if (state === 'booking-canceled') return { icon: CreditCard, kicker: 'Payment recorded', title: 'This booking remains canceled.', description: `Payment is recorded for your canceled ${booking}. Contact the care team if you need help with the payment or arranging another visit.` }
  if (state === 'completed') return { icon: CheckCircle2, kicker: 'Payment recorded', title: 'This appointment is complete.', description: `Your ${booking} has already been completed. Its payment and visit details are available in your appointments.` }
  if (state === 'rescheduled') return { icon: CheckCircle2, kicker: 'Payment recorded', title: 'Your new appointment time is saved.', description: `Your ${booking} has been rescheduled. Check your appointments for the current date and time.` }
  if (state === 'refunded') return { icon: CreditCard, kicker: 'Payment record', title: 'This payment is marked refunded.', description: 'Review your appointment record or contact the care team for details about this refund.' }
  if (state === 'canceled') return { icon: XCircle, kicker: 'Checkout canceled', title: 'No payment was completed.', description: `You left checkout before paying for this ${booking}. Review your appointments before trying again.` }
  return { icon: XCircle, kicker: 'Confirmation issue', title: 'We could not confirm the payment.', description: message }
}
