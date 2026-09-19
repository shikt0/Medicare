import { useEffect, useState } from 'react'
import {
  Activity,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  ListChecks,
  FlaskConical,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import logoImg from '../assets/logo.png'
import { useStaffAuth } from '../auth/staffAuth'
import { ROLE_PORTAL_HOME } from '../auth/rolePortals'

const adminNavGroups = [
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
  {
    label: 'Workforce operations',
    items: [
      { to: '/staff-management', label: 'Staff management', icon: BriefcaseBusiness },
      { to: '/duty-management', label: 'Duty management', icon: CalendarDays },
      { to: '/laboratory', label: 'Laboratory', icon: FlaskConical },
      { to: '/recruitment', label: 'Recruitment', icon: UserRoundCog },
      { to: '/announcements', label: 'Announcements', icon: BellRing },
      { to: '/freelancer-assignments', label: 'Freelancers', icon: BriefcaseBusiness },
    ],
  },
]

const roleNavGroups = {
  nurse: [{ label: 'Nursing workspace', items: [{ to: '/nurse-portal', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/nurse-portal/schedule', label: 'My duty schedule', icon: CalendarDays }, { to: '/nurse-portal/announcements', label: 'Announcements', icon: BellRing }, { to: '/nurse-portal/profile', label: 'My profile', icon: UsersRound }] }],
  pathologist: [{ label: 'Laboratory workspace', items: [{ to: '/pathologist-portal', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/pathologist-portal/service-requests', label: 'Service requests', icon: ListChecks }, { to: '/pathologist-portal/laboratory', label: 'Laboratory queue', icon: FlaskConical }, { to: '/pathologist-portal/announcements', label: 'Announcements', icon: BellRing }, { to: '/pathologist-portal/profile', label: 'My profile', icon: UsersRound }] }],
  hr: [{ label: 'People operations', items: [{ to: '/hr-portal', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/hr-portal/staff', label: 'Staff directory', icon: UsersRound }, { to: '/hr-portal/duties', label: 'Duty management', icon: CalendarDays }, { to: '/hr-portal/recruitment', label: 'Recruitment', icon: UserRoundCog }, { to: '/hr-portal/announcements', label: 'Announcements', icon: BellRing }, { to: '/hr-portal/freelancers', label: 'Freelancer work', icon: BriefcaseBusiness }, { to: '/hr-portal/profile', label: 'My profile', icon: UsersRound }] }],
  freelancer: [{ label: 'Contract workspace', items: [{ to: '/freelancer-portal', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/freelancer-portal/assignments', label: 'My assignments', icon: BriefcaseBusiness }, { to: '/freelancer-portal/announcements', label: 'Announcements', icon: BellRing }, { to: '/freelancer-portal/profile', label: 'My profile', icon: UsersRound }] }],
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { actor, logout } = useStaffAuth()
  const navGroups = actor?.role === 'admin' ? adminNavGroups : (roleNavGroups[actor?.role] || [])
  const portalName = actor?.role === 'admin' ? 'Admin intelligence' : `${labelize(actor?.role)} portal`
  const portalHome = ROLE_PORTAL_HOME[actor?.role] || '/'

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

        <Link to={portalHome} className="admin-brand" aria-label={`Medicare ${labelize(actor?.role)} dashboard`}>
          <span className="admin-brand__mark"><img src={logoImg} alt="" /></span>
          <span className="min-w-0">
            <span className="admin-brand__name">Medicare</span>
            <span className="admin-brand__label">{portalName}</span>
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
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-xs font-extrabold text-emerald-200">{initials(actor?.name || actor?.email)}</span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{actor?.name || 'Administrator'}</strong><small className="mt-0.5 block truncate text-[10px] text-white/40">{actor?.email || 'Secure admin account'}</small></span>
            <button type="button" onClick={logout} aria-label="Sign out" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/45 hover:bg-white/10 hover:text-white"><LogOut size={15} /></button>
          </div>
          <div className="admin-security-card">
            <span className="admin-security-card__icon"><ShieldCheck size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-white">Private workspace</span>
              <span className="mt-0.5 block text-[10px] text-emerald-100/60">{actor?.role === 'admin' ? 'Medicare administration' : `${labelize(actor?.role)} workspace`}</span>
            </span>
            <span className="admin-live-dot" aria-hidden="true" />
          </div>
          <p className="mt-4 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.17em] text-white/30">
            <Sparkles size={12} /> Care, beautifully managed
          </p>
        </div>
      </aside>

      <header className="admin-mobile-header">
        <Link to={portalHome} onClick={() => setOpen(false)} className="admin-mobile-brand" aria-label={`Medicare ${labelize(actor?.role)} dashboard`}>
          <span className="admin-mobile-brand__mark"><img src={logoImg} alt="" /></span>
          <span>
            <span className="block text-sm font-extrabold leading-none tracking-tight text-slate-950">Medicare</span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-700">{portalName}</span>
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
                <p className="text-sm font-extrabold text-slate-950">{labelize(actor?.role)} workspace</p>
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
            <button type="button" onClick={logout} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-100 bg-rose-50 text-sm font-bold text-rose-700"><LogOut size={16} /> Sign out</button>
          </nav>
        </div>
      )}
    </>
  )
}

function initials(value = 'Admin') {
  return String(value).split(/[\s@]/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function labelize(value = 'staff') {
  return String(value).split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
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
