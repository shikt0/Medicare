import { useEffect, useState } from 'react'
import { Activity, ArrowRight, BellRing, BriefcaseBusiness, CalendarDays, FlaskConical, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStaffAuth } from '../auth/staffAuth'
import { ErrorMessage, LoadingState, PageHeader, Panel, StatCard } from '../components/AdminUi'
import { api } from '../lib/api'
import Hero from './Hero'

const configs = {
  nurse: {
    title: 'Nurse Dashboard', subtitle: 'Your current duty schedule and care coordination overview.',
    stats: [['Today shifts', 'todayShifts'], ['Upcoming duties', 'upcomingShifts'], ['Hours this week', 'weekHours'], ['Unread notices', 'unreadAnnouncements']],
    links: [['My duty schedule', '/nurse-portal/schedule', CalendarDays], ['Announcements', '/nurse-portal/announcements', BellRing], ['My profile', '/nurse-portal/profile', UsersRound]],
  },
  pathologist: {
    title: 'Pathologist Dashboard', subtitle: 'Prioritized laboratory work assigned to you.',
    stats: [['Open assignments', 'assigned'], ['Urgent tests', 'urgent'], ['Processing', 'processing'], ['Completed', 'completed']],
    links: [['Laboratory queue', '/pathologist-portal/laboratory', FlaskConical], ['Announcements', '/pathologist-portal/announcements', BellRing], ['My profile', '/pathologist-portal/profile', UsersRound]],
  },
  hr: {
    title: 'HR Dashboard', subtitle: 'Workforce operations, recruitment, and hospital communications.',
    stats: [['Staff records', 'staff'], ['Open jobs', 'openJobs'], ['Active applicants', 'applicants'], ['Recent hires', 'recentHires']],
    links: [['Staff directory', '/hr-portal/staff', UsersRound], ['Duty management', '/hr-portal/duties', CalendarDays], ['Recruitment', '/hr-portal/recruitment', BriefcaseBusiness], ['Announcements', '/hr-portal/announcements', BellRing]],
  },
  freelancer: {
    title: 'Freelancer Dashboard', subtitle: 'Your assigned hospital work and upcoming commitments.',
    stats: [['Active work', 'active'], ['Upcoming', 'upcoming'], ['Completed', 'completed'], ['Unread notices', 'unreadAnnouncements']],
    links: [['My assignments', '/freelancer-portal/assignments', BriefcaseBusiness], ['Announcements', '/freelancer-portal/announcements', BellRing], ['My profile', '/freelancer-portal/profile', UsersRound]],
  },
}

export default function PortalHome() {
  const { actor } = useStaffAuth()
  if (actor?.role === 'admin') return <Hero />
  return <StaffHome role={actor?.role} />
}

function StaffHome({ role }) {
  const config = configs[role] || configs.nurse
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    api.getDashboard().then((value) => { if (current) setData(value) }).catch((loadError) => { if (current) setError(loadError.message) })
    return () => { current = false }
  }, [])

  return (
    <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader title={config.title} subtitle={config.subtitle} />
        <ErrorMessage message={error} />
        {!data ? <Panel><LoadingState label="Loading your dashboard..." /></Panel> : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {config.stats.map(([label, key]) => <StatCard key={key} label={label} value={formatValue(data[key], key)} />)}
            </section>
            <Panel className="mt-6 p-5">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Activity size={20} /></span><div><h2 className="font-bold text-slate-900">Your workspace</h2><p className="text-sm text-slate-500">Open a secure module for your role.</p></div></div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {config.links.map(([label, to, Icon]) => <Link key={to} to={to} className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-emerald-200 hover:bg-emerald-50"><Icon size={19} className="text-emerald-700" /><span className="flex-1 text-sm font-bold text-slate-800">{label}</span><ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-600" /></Link>)}
              </div>
            </Panel>
          </>
        )}
      </div>
    </main>
  )
}

function formatValue(value, key) {
  if (key === 'weekHours') return `${Number(value || 0).toFixed(1)}h`
  return value ?? 0
}
