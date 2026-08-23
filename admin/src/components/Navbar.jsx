import { useEffect, useState } from 'react'
import {
  Activity,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import logoImg from '../assets/logo.png'

const navGroups = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Doctor care',
    items: [
      { to: '/add', label: 'Add doctor', icon: UserPlus },
      { to: '/list', label: 'Doctors', icon: UsersRound },
      { to: '/appointments', label: 'Appointments', icon: CalendarDays },
    ],
  },
  {
    label: 'Clinical services',
    items: [
      { to: '/service-dashboard', label: 'Service overview', icon: Activity },
      { to: '/add-service', label: 'Add service', icon: Plus },
      { to: '/list-service', label: 'Services', icon: Stethoscope },
      { to: '/service-appointments', label: 'Service bookings', icon: ListChecks },
    ],
  },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return (
    <>
      <aside className="admin-sidebar" aria-label="Admin sidebar">
        <div className="admin-sidebar__glow admin-sidebar__glow--top" aria-hidden="true" />
        <div className="admin-sidebar__glow admin-sidebar__glow--bottom" aria-hidden="true" />

        <Link to="/" className="admin-brand" aria-label="Medicare admin dashboard">
          <span className="admin-brand__mark"><img src={logoImg} alt="" /></span>
          <span className="min-w-0">
            <span className="admin-brand__name">Medicare</span>
            <span className="admin-brand__label">Admin intelligence</span>
          </span>
        </Link>

        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          {navGroups.map((group) => (
            <div key={group.label} className="admin-nav-group">
              <p className="admin-nav-group__label">{group.label}</p>
              <div className="space-y-1.5">
                {group.items.map((item) => <DesktopNavItem key={item.to} item={item} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <div className="admin-security-card">
            <span className="admin-security-card__icon"><ShieldCheck size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-white">Private workspace</span>
              <span className="mt-0.5 block text-[10px] text-emerald-100/60">Medicare administration</span>
            </span>
            <span className="admin-live-dot" aria-hidden="true" />
          </div>
          <p className="mt-4 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/30">
            <Sparkles size={12} /> Care, beautifully managed
          </p>
        </div>
      </aside>

      <header className="admin-mobile-header">
        <Link to="/" onClick={() => setOpen(false)} className="admin-mobile-brand" aria-label="Medicare admin dashboard">
          <span className="admin-mobile-brand__mark"><img src={logoImg} alt="" /></span>
          <span>
            <span className="block text-sm font-extrabold leading-none tracking-tight text-slate-950">Medicare</span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-700">Admin console</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mobile-admin-navigation"
          className="admin-mobile-menu-button"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {open && (
        <div className="admin-mobile-navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="admin-mobile-navigation__backdrop"
          />
          <nav id="mobile-admin-navigation" aria-label="Mobile admin navigation" className="admin-mobile-navigation__panel">
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-extrabold text-slate-950">Admin workspace</p>
                <p className="mt-0.5 text-xs text-slate-500">Choose where you want to go</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles size={16} /></span>
            </div>
            {navGroups.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.items.map((item) => <MobileNavItem key={item.to} item={item} onNavigate={() => setOpen(false)} />)}
                </div>
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}

function DesktopNavItem({ item }) {
  const NavIcon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `admin-sidebar-link ${isActive ? 'admin-sidebar-link--active' : ''}`}
    >
      <span className="admin-sidebar-link__icon"><NavIcon size={18} /></span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <ChevronRight className="admin-sidebar-link__chevron" size={15} />
    </NavLink>
  )
}

function MobileNavItem({ item, onNavigate }) {
  const NavIcon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => `admin-mobile-link ${isActive ? 'admin-mobile-link--active' : ''}`}
    >
      <span className="admin-mobile-link__icon"><NavIcon size={18} /></span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <ChevronRight size={14} className="text-slate-300" />
    </NavLink>
  )
}
