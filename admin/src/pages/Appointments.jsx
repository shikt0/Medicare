import React, { useEffect, useState } from 'react'
import { Check, RefreshCcw, Search, X } from 'lucide'
import { api } from '../lib/api'
import { doctorNameFromAppointment, formatCurrency, formatDate, getId } from '../lib/format'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, PanelHeader, StatusBadge } from '../components/AdminUi'
import Icon from '../components/Icon'

const statusOptions = ['', 'Pending', 'Confirmed', 'Completed', 'Canceled', 'Rescheduled']

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState('')

  async function loadAppointments(nextFilters = filters) {
    setLoading(true)
    setError('')
    try {
      setAppointments(await api.getAppointments({ ...nextFilters, limit: 200 }))
    } catch (err) {
      setError(err.message || 'Unable to load appointments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments({ search: '', status: '' })
  }, [])

  async function setStatus(appointment, status) {
    const id = getId(appointment)
    if (!id) return
    setWorkingId(`${id}-${status}`)
    setError('')
    try {
      if (status === 'Canceled') {
        await api.cancelAppointment(id)
      } else {
        await api.updateAppointment(id, { status })
      }
      await loadAppointments(filters)
    } catch (err) {
      setError(err.message || 'Unable to update appointment.')
    } finally {
      setWorkingId('')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 font-serif">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="Appointments" subtitle="Manage doctor appointments and update patient booking statuses." />
        <div className="space-y-4">
          <ErrorMessage message={error} />
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Doctor Appointment Queue"
              subtitle={`${appointments.length} appointments loaded`}
              actions={(
                <div className="flex flex-wrap gap-2">
                  <label className="relative">
                    <Icon icon={Search} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') loadAppointments({ ...filters, search: event.currentTarget.value })
                      }}
                      placeholder="Search patient or phone"
                      className="w-60 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <select
                    value={filters.status}
                    onChange={(event) => {
                      const next = { ...filters, status: event.target.value }
                      setFilters(next)
                      loadAppointments(next)
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{status || 'All statuses'}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => loadAppointments(filters)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Icon icon={RefreshCcw} />
                    Refresh
                  </button>
                </div>
              )}
            />
            {loading ? (
              <LoadingState />
            ) : appointments.length === 0 ? (
              <EmptyState label="No doctor appointments found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Patient</th>
                      <th className="px-5 py-3">Doctor</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Payment</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Fee</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {appointments.map((appointment) => {
                      const id = getId(appointment)
                      const disabled = appointment.status === 'Completed' || appointment.status === 'Canceled'
                      return (
                        <tr key={id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">{appointment.patientName || '-'}</p>
                            <p className="text-xs text-slate-500">{appointment.mobile || '-'}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{doctorNameFromAppointment(appointment)}</td>
                          <td className="px-5 py-4 text-slate-600">{formatDate(appointment.date)}</td>
                          <td className="px-5 py-4 text-slate-600">{appointment.time || '-'}</td>
                          <td className="px-5 py-4"><StatusBadge value={appointment.payment?.status || 'Pending'} /></td>
                          <td className="px-5 py-4"><StatusBadge value={appointment.status} /></td>
                          <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatCurrency(appointment.fees)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <ActionButton
                                icon={Check}
                                label="Confirm"
                                disabled={disabled || appointment.status === 'Confirmed'}
                                busy={workingId === `${id}-Confirmed`}
                                onClick={() => setStatus(appointment, 'Confirmed')}
                              />
                              <ActionButton
                                icon={Check}
                                label="Complete"
                                disabled={disabled}
                                busy={workingId === `${id}-Completed`}
                                onClick={() => setStatus(appointment, 'Completed')}
                              />
                              <ActionButton
                                icon={X}
                                label="Cancel"
                                tone="danger"
                                disabled={disabled}
                                busy={workingId === `${id}-Canceled`}
                                onClick={() => setStatus(appointment, 'Canceled')}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </main>
  )
}

function ActionButton({ icon, label, onClick, disabled, busy, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
    : 'border-slate-200 text-slate-700 hover:bg-slate-50'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      <Icon icon={icon} size={14} />
      {busy ? '...' : label}
    </button>
  )
}
