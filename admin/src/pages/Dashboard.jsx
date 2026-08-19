import React, { useEffect, useMemo, useState } from 'react'
import { RefreshCcw } from 'lucide'
import { api } from '../lib/api'
import { doctorNameFromAppointment, formatCurrency, formatDate, getId, serviceAppointmentTime, serviceNameFromAppointment } from '../lib/format'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, PanelHeader, StatCard, StatusBadge } from '../components/AdminUi'
import Icon from '../components/Icon'

export default function Dashboard() {
  const [state, setState] = useState({
    doctors: [],
    services: [],
    appointments: [],
    serviceAppointments: [],
    loading: true,
    error: '',
  })

  async function loadDashboard() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const [doctors, services, appointments, serviceAppointments] = await Promise.all([
        api.getDoctors(),
        api.getServices(),
        api.getAppointments({ limit: 20 }),
        api.getServiceAppointments({ limit: 20 }),
      ])

      setState({
        doctors,
        services,
        appointments,
        serviceAppointments,
        loading: false,
        error: '',
      })
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.message || 'Unable to load admin dashboard.',
      }))
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const summary = useMemo(() => {
    const allAppointments = [
      ...state.appointments.map((item) => ({ ...item, kind: 'Doctor' })),
      ...state.serviceAppointments.map((item) => ({ ...item, kind: 'Service' })),
    ]
    const pending = allAppointments.filter((item) => item.status === 'Pending').length
    const completed = allAppointments.filter((item) => item.status === 'Completed' || item.status === 'Confirmed').length
    const revenue = allAppointments.reduce((total, item) => {
      const paid = item.payment?.status === 'Paid' || item.status === 'Completed' || item.status === 'Confirmed'
      return paid ? total + Number(item.fees || 0) : total
    }, 0)

    return { allAppointments, pending, completed, revenue }
  }, [state.appointments, state.serviceAppointments])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 font-serif">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Dashboard"
          subtitle="Live overview of doctors, services, and appointment activity."
          actions={(
            <button
              type="button"
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Icon icon={RefreshCcw} />
              Refresh
            </button>
          )}
        />

        <ErrorMessage message={state.error} />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Doctors" value={state.doctors.length} detail="Active provider records" />
          <StatCard label="Services" value={state.services.length} detail="Managed care services" />
          <StatCard label="Pending" value={summary.pending} detail="Needs admin follow-up" />
          <StatCard label="Revenue" value={formatCurrency(summary.revenue)} detail={`${summary.completed} confirmed/completed bookings`} />
        </div>

        <Panel className="mt-6 overflow-hidden">
          <PanelHeader title="Recent Appointments" subtitle="Doctor and service bookings in one queue." />
          {state.loading ? (
            <LoadingState />
          ) : summary.allAppointments.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Patient</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">With</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {summary.allAppointments.slice(0, 10).map((item) => (
                    <tr key={`${item.kind}-${getId(item)}`} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-medium text-slate-900">{item.patientName || '-'}</td>
                      <td className="px-5 py-4 text-slate-600">{item.kind}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {item.kind === 'Doctor' ? doctorNameFromAppointment(item) : serviceNameFromAppointment(item)}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(item.date)}</td>
                      <td className="px-5 py-4 text-slate-600">{item.kind === 'Doctor' ? item.time : serviceAppointmentTime(item)}</td>
                      <td className="px-5 py-4"><StatusBadge value={item.status} /></td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatCurrency(item.fees)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </main>
  )
}
