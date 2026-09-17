import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, KeyRound, Menu, ShieldCheck, UserRound, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth, UserButton } from '@clerk/react'
import logo from '../assets/logo.png'

const navItems = [
  { label: 'Home', href: '/', end: true },
  { label: 'Doctors', href: '/doctors' },
  { label: 'Services', href: '/services' },
  { label: 'Appointments', href: '/appointments' },
  { label: 'Lab Results', href: '/lab-results' },
  { label: 'Contact', href: '/contact' },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [showNavbar, setShowNavbar] = useState(true)
  const lastScrollY = useRef(0)
  const navRef = useRef(null)
  const { isSignedIn } = useAuth()

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY
      setShowNavbar(!(currentScrollY > lastScrollY.current && currentScrollY > 80))
      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (isOpen && navRef.current && !navRef.current.contains(event.target)) setIsOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <header ref={navRef} className={`site-navbar ${showNavbar ? 'site-navbar--visible' : 'site-navbar--hidden'}`}>
      <nav className="site-navbar__inner" aria-label="Primary navigation">
        <Link to="/" onClick={() => setIsOpen(false)} className="site-brand" aria-label="MediCare home">
          <span className="site-brand__mark"><img src={logo} alt="" /></span>
          <span>
            <span className="site-brand__name">MediCare</span>
            <span className="site-brand__tagline">Health, thoughtfully delivered</span>
          </span>
        </Link>

        <div className="site-navbar__links">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              className={({ isActive }) => `site-nav-link ${isActive ? 'site-nav-link--active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="site-navbar__actions">
          {!isSignedIn ? (
            <>
              <Link to="/login" className="site-doctor-link">
                <UserRound size={16} />
                <span>Login portals</span>
                <ArrowUpRight size={13} />
              </Link>
              <Link to="/patient-login" className="site-login-button">
                <KeyRound size={16} />
                <span>Patient login</span>
              </Link>
            </>
          ) : (
            <div className="site-user-button"><UserButton afterSignOutUrl="/" /></div>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="site-menu-button"
            aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isOpen}
            aria-controls="patient-mobile-navigation"
          >
            {isOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div id="patient-mobile-navigation" className="site-mobile-menu">
          <div className="site-mobile-menu__intro">
            <span className="site-mobile-menu__shield"><ShieldCheck size={18} /></span>
            <div>
              <p>Private patient access</p>
              <span>Your healthcare journey, all in one place.</span>
            </div>
          </div>

          <div className="site-mobile-menu__links">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.end}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => `site-mobile-link ${isActive ? 'site-mobile-link--active' : ''}`}
              >
                {item.label}<ArrowUpRight size={15} />
              </NavLink>
            ))}
          </div>

          {!isSignedIn && (
            <div className="site-mobile-menu__actions">
              <Link to="/login" onClick={() => setIsOpen(false)} className="site-mobile-doctor-link">All login portals</Link>
              <Link to="/patient-login" onClick={() => setIsOpen(false)} className="site-mobile-login-button">
                <KeyRound size={16} /> Patient login
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
