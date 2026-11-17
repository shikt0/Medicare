import React from 'react'
import { Inbox, LoaderCircle } from 'lucide-react'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-heading mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">MediCare workspace</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Panel({ children, className = '' }) {
  return (
    <section className={`admin-panel rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  )
}

export function PanelHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, detail }) {
  return (
    <div className="admin-stat rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

export function StatusBadge({ value }) {
  const normalized = String(value || 'Unknown')
  const key = normalized.toLowerCase()
  const classes = {
    available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    unavailable: 'bg-rose-50 text-rose-700 ring-rose-200',
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    confirmed: 'bg-sky-50 text-sky-700 ring-sky-200',
    completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    canceled: 'bg-rose-50 text-rose-700 ring-rose-200',
    rescheduled: 'bg-violet-50 text-violet-700 ring-violet-200',
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200',
    refunded: 'bg-slate-100 text-slate-700 ring-slate-200',
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    inactive: 'bg-rose-50 text-rose-700 ring-rose-200',
    'on-leave': 'bg-amber-50 text-amber-700 ring-amber-200',
    scheduled: 'bg-sky-50 text-sky-700 ring-sky-200',
    cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
    ordered: 'bg-sky-50 text-sky-700 ring-sky-200',
    'sample-collected': 'bg-violet-50 text-violet-700 ring-violet-200',
    processing: 'bg-amber-50 text-amber-700 ring-amber-200',
    urgent: 'bg-rose-50 text-rose-700 ring-rose-200',
    normal: 'bg-slate-100 text-slate-700 ring-slate-200',
    open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    closed: 'bg-slate-100 text-slate-700 ring-slate-200',
    applied: 'bg-sky-50 text-sky-700 ring-sky-200',
    reviewing: 'bg-amber-50 text-amber-700 ring-amber-200',
    shortlisted: 'bg-violet-50 text-violet-700 ring-violet-200',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
    hired: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    assigned: 'bg-sky-50 text-sky-700 ring-sky-200',
    accepted: 'bg-violet-50 text-violet-700 ring-violet-200',
    'in-progress': 'bg-amber-50 text-amber-700 ring-amber-200',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[normalized] || classes[key] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {key.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')}
    </span>
  )
}

export function LoadingState({ label = 'Loading data...' }) {
  return <div role="status" className="flex min-h-40 items-center justify-center gap-3 px-5 py-8 text-sm text-slate-500"><LoaderCircle size={20} aria-hidden="true" className="animate-spin text-emerald-700" />{label}</div>
}

export function EmptyState({ label = 'No records found.' }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 py-10 text-center text-sm text-slate-500"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Inbox size={22} aria-hidden="true" /></span><p className="max-w-md leading-6">{label}</p></div>
}

export function ErrorMessage({ message }) {
  if (!message) return null
  return (
    <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
      {message}
    </div>
  )
}

export function SuccessMessage({ message }) {
  if (!message) return null
  return (
    <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
      {message}
    </div>
  )
}
