import { useEffect, useState } from 'react'
import {
  Activity,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
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
    label: 'Doctors',
    items: [
      { to: '/add', label: 'Add doctor', icon: UserPlus },
      { to: '/list', label: 'Doctors', icon: UsersRound },
      { to: '/appointments', label: 'Appointments', icon: CalendarDays },
    ],
  },
  {
    label: 'Services',
    items: [
      { to: '/service-dashboard', label: 'Service overview', icon: Activity },
      { to: '/add-service', label: 'Add service', icon: Plus },
      { to: '/list-service', label: 'Services', icon: Stethoscope },
      { to: '/service-appointments', label: 'Service bookings', icon: ListChecks },
    ],
  },
]

const navItems = navGroups.flatMap((group) => group.items)

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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <nav aria-label="Admin navigation" className="mx-auto flex min-h-20 max-w-[90rem] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link to="/" onClick={() => setOpen(false)} className="flex shrink-0 items-center gap-3" aria-label="Medicare admin dashboard">
          <img src={logoImg} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-emerald-100" />
          <span className="hidden sm:block">
            <span className="block text-base font-extrabold leading-tight tracking-tight text-slate-950">Medicare</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Admin console</span>
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end lg:flex">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto py-2">
            {navItems.map((item) => <DesktopNavItem key={item.to} item={item} />)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mobile-admin-navigation"
          className="ml-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>

      {open && (
        <div className="lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-20 z-40 bg-slate-950/25 backdrop-blur-sm"
          />
          <div
            id="mobile-admin-navigation"
            className="absolute left-3 right-3 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl sm:left-auto sm:right-6 sm:w-96"
          >
            {navGroups.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {group.label}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.items.map((item) => <MobileNavItem key={item.to} item={item} onNavigate={() => setOpen(false)} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}

function DesktopNavItem({ item }) {
  const NavIcon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
      }`}
    >
      <NavIcon size={16} />
      {item.label}
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
      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${
        isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <NavIcon size={18} />
      {item.label}
    </NavLink>
  )
}
