import { ArrowUpRight, HeartPulse, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'

const careLinks = [
  ['Find a doctor', '/doctors'],
  ['Explore services', '/services'],
  ['Appointments', '/appointments'],
]

const supportLinks = [
  ['Contact us', '/contact'],
  ['Login portals', '/login'],
  ['Doctor portal', '/doctor/login'],
  ['Patient home', '/'],
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__glow" aria-hidden="true" />
      <div className="site-footer__inner">
        <div className="site-footer__brand-column">
          <Link to="/" className="site-footer__brand">
            <span><img src={logo} alt="" /></span>
            <div><strong>MediCare</strong><small>Health Solutions</small></div>
          </Link>
          <p>Thoughtful digital access to doctors, services, and the care you need.</p>
          <div className="site-footer__trust"><ShieldCheck size={16} /> Private, patient-first experience</div>
        </div>

        <FooterLinks title="Care" links={careLinks} />
        <FooterLinks title="Support" links={supportLinks} />

        <div className="site-footer__statement">
          <span><HeartPulse size={18} /></span>
          <p>Better care begins with a simpler first step.</p>
          <Link to="/doctors">Start your journey <ArrowUpRight size={15} /></Link>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} MediCare Health Solutions</p>
        <p>Designed around your wellbeing.</p>
      </div>
    </footer>
  )
}

function FooterLinks({ title, links }) {
  return (
    <div className="site-footer__links">
      <h2>{title}</h2>
      {links.map(([label, to]) => <Link key={`${label}-${to}`} to={to}>{label}<ArrowUpRight size={13} /></Link>)}
    </div>
  )
}
