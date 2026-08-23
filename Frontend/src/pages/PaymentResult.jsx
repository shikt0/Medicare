import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, CreditCard, LoaderCircle, XCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { patientApi } from '../lib/api'

export default function PaymentResult({ kind = 'doctor', outcome = 'success' }) {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const started = useRef(false)
  const [state, setState] = useState(outcome === 'success' ? 'loading' : 'canceled')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (outcome !== 'success' || started.current) return
    started.current = true
    if (!sessionId) {
      setState('error')
      setMessage('The payment session is missing. Review your appointments for the latest status.')
      return
    }

    const confirm = kind === 'service' ? patientApi.confirmServicePayment : patientApi.confirmAppointmentPayment
    confirm(sessionId)
      .then(() => setState('success'))
      .catch((error) => {
        setState('error')
        setMessage(error.message || 'We could not confirm the payment.')
      })
  }, [kind, outcome, sessionId])

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
  if (state === 'success') return { icon: CheckCircle2, kicker: 'Payment confirmed', title: 'Your booking is confirmed.', description: `Payment for your ${booking} was successful. You can review the full details in your appointments.` }
  if (state === 'canceled') return { icon: XCircle, kicker: 'Checkout canceled', title: 'No payment was completed.', description: `You left checkout before paying for this ${booking}. Review your appointments before trying again.` }
  return { icon: XCircle, kicker: 'Confirmation issue', title: 'We could not confirm the payment.', description: message }
}
