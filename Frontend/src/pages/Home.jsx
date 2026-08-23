import {
  Activity,
  ArrowRight,
  CalendarCheck,
  Check,
  Clock3,
  HeartPulse,
  Microscope,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import careTeam from '../assets/BannerImg.png'
import doctorOne from '../assets/D3.png'
import doctorTwo from '../assets/D4.png'
import doctorThree from '../assets/D6.png'

const careBenefits = [
  { icon: ShieldCheck, title: 'Verified care', text: 'Connect with trusted healthcare professionals.' },
  { icon: CalendarCheck, title: 'Simple booking', text: 'Move from search to appointment with less friction.' },
  { icon: Clock3, title: 'Care that fits', text: 'Find options designed around your schedule.' },
  { icon: HeartPulse, title: 'Patient focused', text: 'A calm experience built around your wellbeing.' },
]

const specialties = [
  { icon: Stethoscope, title: 'Primary care', text: 'Everyday guidance, routine checkups, and ongoing support.', tone: 'mint' },
  { icon: HeartPulse, title: 'Cardiology', text: 'Specialist attention for your heart and vascular health.', tone: 'rose' },
  { icon: Microscope, title: 'Diagnostics', text: 'Essential testing and clearer next steps for your care.', tone: 'sky' },
  { icon: Activity, title: 'Preventive health', text: 'Stay ahead with screenings and thoughtful monitoring.', tone: 'violet' },
]

const careTeamCards = [
  { image: doctorOne, title: 'General medicine', detail: 'Whole-person, everyday care' },
  { image: doctorTwo, title: 'Specialist care', detail: 'Expert guidance when you need it' },
  { image: doctorThree, title: 'Preventive care', detail: 'Health planning for the long term' },
]

const journey = [
  { number: '01', title: 'Discover', text: 'Browse doctors and care services with confidence.' },
  { number: '02', title: 'Choose', text: 'Select the option that best fits your needs.' },
  { number: '03', title: 'Book', text: 'Secure your appointment and keep care moving.' },
]

export default function Home() {
  return (
    <div className="patient-site">
      <Navbar />

      <main>
        <section className="home-hero">
          <div className="home-hero__orb home-hero__orb--one" aria-hidden="true" />
          <div className="home-hero__orb home-hero__orb--two" aria-hidden="true" />
          <div className="home-hero__inner">
            <div className="home-hero__content">
              <div className="premium-eyebrow"><Sparkles size={14} /> A better way to access care</div>
              <h1>Healthcare that feels <em>personal.</em></h1>
              <p className="home-hero__lead">Discover trusted doctors, essential medical services, and a simpler path to your next appointment—all in one considered experience.</p>

              <div className="home-hero__actions">
                <Link to="/doctors" className="premium-button premium-button--primary">Find a doctor <ArrowRight size={17} /></Link>
                <Link to="/services" className="premium-button premium-button--secondary">Explore services</Link>
              </div>

              <div className="home-hero__proof">
                <div className="home-hero__avatars">
                  {[doctorOne, doctorTwo, doctorThree].map((image, index) => <img key={image} src={image} alt="" style={{ zIndex: 3 - index }} />)}
                </div>
                <div>
                  <div className="home-hero__stars"><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /><Star size={13} fill="currentColor" /></div>
                  <p>Care built on trust and clarity</p>
                </div>
              </div>
            </div>

            <div className="home-hero__visual">
              <div className="home-hero__visual-ring" aria-hidden="true" />
              <div className="home-hero__image-panel">
                <span className="home-hero__image-label"><span /> Your care team</span>
                <img src={careTeam} alt="A team of healthcare professionals" />
              </div>
              <div className="home-float-card home-float-card--top">
                <span className="home-float-card__icon"><CalendarCheck size={18} /></span>
                <div><strong>Easy appointments</strong><small>Book with confidence</small></div>
              </div>
              <div className="home-float-card home-float-card--bottom">
                <span className="home-float-card__icon home-float-card__icon--dark"><ShieldCheck size={18} /></span>
                <div><strong>Trusted professionals</strong><small>Care you can rely on</small></div>
              </div>
            </div>
          </div>
        </section>

        <section className="care-benefits" aria-label="Why choose MediCare">
          <div className="care-benefits__inner">
            {careBenefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="care-benefit">
                <span><Icon size={19} /></span>
                <div><h2>{title}</h2><p>{text}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="premium-section premium-section--services">
          <div className="premium-section__heading">
            <div><p className="premium-kicker">Care, made clearer</p><h2>Support for every chapter of your health.</h2></div>
            <div><p>From everyday wellness to specialist support, find the right care without the usual complexity.</p><Link to="/services">View all services <ArrowRight size={16} /></Link></div>
          </div>

          <div className="specialty-grid">
            {specialties.map(({ icon: Icon, title, text, tone }, index) => (
              <Link key={title} to="/services" className={`specialty-card specialty-card--${tone}`}>
                <div className="specialty-card__top"><span><Icon size={23} /></span><small>0{index + 1}</small></div>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="specialty-card__link">Learn more <ArrowRight size={15} /></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="premium-section care-team-section">
          <div className="care-team-section__intro">
            <p className="premium-kicker">Expertise with empathy</p>
            <h2>A care team chosen around you.</h2>
            <p>Explore a network of professionals who bring clinical experience and a human touch to every appointment.</p>
            <ul>
              <li><Check size={15} /> Clear professional profiles</li>
              <li><Check size={15} /> Availability at a glance</li>
              <li><Check size={15} /> Simple appointment access</li>
            </ul>
            <Link to="/doctors" className="premium-button premium-button--dark">Meet our doctors <ArrowRight size={17} /></Link>
          </div>

          <div className="care-team-grid">
            {careTeamCards.map((doctor, index) => (
              <Link to="/doctors" key={doctor.title} className={`care-team-card ${index === 1 ? 'care-team-card--lifted' : ''}`}>
                <div className="care-team-card__image"><img src={doctor.image} alt="Healthcare professional" /></div>
                <div><span>Available care</span><h3>{doctor.title}</h3><p>{doctor.detail}</p></div>
                <span className="care-team-card__arrow"><ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="journey-section">
          <div className="journey-section__inner">
            <div className="journey-section__heading">
              <p className="premium-kicker premium-kicker--light">Designed for ease</p>
              <h2>From searching to seen in three simple steps.</h2>
            </div>
            <div className="journey-grid">
              {journey.map((item) => (
                <article key={item.number} className="journey-card">
                  <span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-closing">
          <div className="home-closing__inner">
            <div className="home-closing__icon"><UsersRound size={25} /></div>
            <p className="premium-kicker">Your health, your next step</p>
            <h2>Ready for care that puts you first?</h2>
            <p>Find the right doctor or service and take the next step with confidence.</p>
            <div><Link to="/doctors" className="premium-button premium-button--primary">Find your doctor <ArrowRight size={17} /></Link><Link to="/contact" className="home-closing__contact">Talk to us</Link></div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
