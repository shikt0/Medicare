import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Compass,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'

const pageContent = {
  Doctors: {
    kicker: 'Clinical directory',
    heading: 'Find expertise that feels personal.',
    description: 'Explore trusted healthcare professionals and choose care that aligns with your needs, schedule, and preferences.',
    icon: Stethoscope,
    badge: 'Trusted care network',
    highlights: [
      ['Clear profiles', 'Understand experience and areas of care at a glance.'],
      ['Visible availability', 'Choose an appointment time that works for you.'],
      ['Confident decisions', 'Find the right professional without the guesswork.'],
    ],
    primary: ['Explore services', '/services'],
  },
  Services: {
    kicker: 'Care services',
    heading: 'Essential care, thoughtfully organized.',
    description: 'Discover diagnostic, preventive, and specialist services designed to make your next step feel clear and manageable.',
    icon: Activity,
    badge: 'Care for every stage',
    highlights: [
      ['Diagnostics', 'Access essential testing and clearer health insights.'],
      ['Preventive care', 'Stay ahead with checkups and routine screening.'],
      ['Specialist support', 'Connect with focused expertise when it matters.'],
    ],
    primary: ['Browse doctors', '/doctors'],
  },
  Appointments: {
    kicker: 'Your appointments',
    heading: 'Your care schedule, without the clutter.',
    description: 'Keep doctor visits and service bookings in one calm, easy-to-understand place.',
    icon: CalendarCheck,
    badge: 'Organized around you',
    highlights: [
      ['Upcoming care', 'See what is next in your healthcare journey.'],
      ['Clear details', 'Keep essential appointment information together.'],
      ['Patient access', 'Sign in securely through the patient login above.'],
    ],
    primary: ['Find care', '/doctors'],
  },
  Contact: {
    kicker: 'Here to help',
    heading: 'Support should feel human, too.',
    description: 'Whether you need help finding care or understanding your next step, MediCare keeps support close and approachable.',
    icon: MessageCircle,
    badge: 'Patient-first support',
    highlights: [
      ['Care guidance', 'Get oriented before choosing a doctor or service.'],
      ['Booking support', 'Find help navigating your appointment journey.'],
      ['General questions', 'Reach the right part of your care experience.'],
    ],
    primary: ['Explore care', '/services'],
  },
  'Doctor Admin Login': {
    kicker: 'Clinical workspace',
    heading: 'A focused space for care professionals.',
    description: 'The doctor portal provides a dedicated entry point for managing clinical work within the MediCare experience.',
    icon: LockKeyhole,
    badge: 'Protected professional access',
    highlights: [
      ['Private access', 'A dedicated route for authorized care professionals.'],
      ['Focused workspace', 'Keep clinical administration separate and clear.'],
      ['Patient continuity', 'Support a smoother experience across the care journey.'],
    ],
    primary: ['Return to patient site', '/'],
  },
  'Page Not Found': {
    kicker: '404 · Lost, not alone',
    heading: 'This page stepped out for a checkup.',
    description: 'The address may have changed, but your route back to care is right here.',
    icon: Compass,
    badge: 'Let us guide you back',
    highlights: [
      ['Patient home', 'Return to the main MediCare experience.'],
      ['Find a doctor', 'Continue exploring your available care options.'],
      ['Browse services', 'Discover support for your health needs.'],
    ],
    primary: ['Back to home', '/'],
  },
}

export default function BasicPage({ title }) {
  const content = pageContent[title] || pageContent['Page Not Found']
  const PageIcon = content.icon

  return (
    <div className="patient-site">
      <Navbar />
      <main className="basic-page">
        <div className="basic-page__ambient" aria-hidden="true" />
        <section className="basic-page__hero">
          <div className="basic-page__copy">
            <div className="premium-eyebrow"><Sparkles size={14} /> {content.kicker}</div>
            <h1>{content.heading}</h1>
            <p>{content.description}</p>
            <div className="basic-page__actions">
              <Link to={content.primary[1]} className="premium-button premium-button--primary">{content.primary[0]} <ArrowRight size={17} /></Link>
              {title !== 'Page Not Found' && <Link to="/" className="basic-page__back"><ArrowLeft size={16} /> Back home</Link>}
            </div>
          </div>

          <div className="basic-page__visual">
            <div className="basic-page__visual-grid" aria-hidden="true" />
            <span className="basic-page__visual-icon"><PageIcon size={34} /></span>
            <div className="basic-page__visual-copy"><small>MediCare experience</small><strong>{title}</strong><p>{content.badge}</p></div>
            <div className="basic-page__visual-status"><span /><ShieldCheck size={15} /> Thoughtfully designed access</div>
          </div>
        </section>

        <section className="basic-page__highlights">
          {content.highlights.map(([heading, text], index) => (
            <article key={heading}>
              <div><span>0{index + 1}</span><CheckCircle2 size={18} /></div>
              <h2>{heading}</h2>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="basic-page__promise">
          <span><HeartHandshake size={22} /></span>
          <div><p>One connected care experience</p><h2>Clear choices. Considered details. Care that starts with you.</h2></div>
          <Link to="/contact">Need guidance? <ArrowRight size={16} /></Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
