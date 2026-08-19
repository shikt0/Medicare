import React from 'react'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  )
}

export function StatusBadge({ value }) {
  const normalized = String(value || 'Unknown')
  const classes = {
    Available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Unavailable: 'bg-rose-50 text-rose-700 ring-rose-200',
    Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    Confirmed: 'bg-sky-50 text-sky-700 ring-sky-200',
    Completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Canceled: 'bg-rose-50 text-rose-700 ring-rose-200',
    Rescheduled: 'bg-violet-50 text-violet-700 ring-violet-200',
    Paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Failed: 'bg-rose-50 text-rose-700 ring-rose-200',
    Refunded: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[normalized] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {normalized}
    </span>
  )
}

export function LoadingState({ label = 'Loading data...' }) {
  return <div className="px-5 py-8 text-sm text-slate-500">{label}</div>
}

export function EmptyState({ label = 'No records found.' }) {
  return <div className="px-5 py-8 text-sm text-slate-500">{label}</div>
}

export function ErrorMessage({ message }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
      {message}
    </div>
  )
}

export function SuccessMessage({ message }) {
  if (!message) return null
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
      {message}
    </div>
  )
}
