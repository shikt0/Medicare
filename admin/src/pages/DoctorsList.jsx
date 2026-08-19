import React, { useEffect, useState } from 'react'
import { RefreshCcw, Search, Trash2 } from 'lucide'
import { api } from '../lib/api'
import { formatCurrency, getId } from '../lib/format'
import { EmptyState, ErrorMessage, LoadingState, PageHeader, Panel, PanelHeader, StatusBadge } from '../components/AdminUi'
import Icon from '../components/Icon'

export default function DoctorsList() {
  const [doctors, setDoctors] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState('')

  async function loadDoctors(search = query) {
    setLoading(true)
    setError('')
    try {
      setDoctors(await api.getDoctors({ q: search, limit: 200 }))
    } catch (err) {
      setError(err.message || 'Unable to load doctors.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDoctors('')
  }, [])

  async function deleteDoctor(doctor) {
    const id = getId(doctor)
    if (!id) return
    if (!window.confirm(`Delete ${doctor.name || 'this doctor'}?`)) return

    setDeletingId(id)
    setError('')
    try {
      await api.deleteDoctor(id)
      setDoctors((current) => current.filter((item) => getId(item) !== id))
    } catch (err) {
      setError(err.message || 'Unable to delete doctor.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 font-serif">
      <div className="mx-auto max-w-7xl">
        <PageHeader title="List Doctors" subtitle="Review provider records and remove inactive profiles." />
        <div className="space-y-4">
          <ErrorMessage message={error} />
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Doctors"
              subtitle={`${doctors.length} provider records loaded`}
              actions={(
                <div className="flex flex-wrap gap-2">
                  <label className="relative">
                    <Icon icon={Search} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') loadDoctors(event.currentTarget.value)
                      }}
                      placeholder="Search doctors"
                      className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => loadDoctors(query)}
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
            ) : doctors.length === 0 ? (
              <EmptyState label="No doctors match this search." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Doctor</th>
                      <th className="px-5 py-3">Specialization</th>
                      <th className="px-5 py-3">Location</th>
                      <th className="px-5 py-3">Fee</th>
                      <th className="px-5 py-3">Availability</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {doctors.map((doctor) => {
                      const id = getId(doctor)
                      return (
                        <tr key={id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {doctor.imageUrl ? (
                                <img src={doctor.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-700">
                                  {(doctor.name || 'D').slice(0, 1)}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-slate-900">{doctor.name || '-'}</p>
                                <p className="text-xs text-slate-500">{doctor.raw?.email || doctor.email || '-'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{doctor.specialization || '-'}</td>
                          <td className="px-5 py-4 text-slate-600">{doctor.location || '-'}</td>
                          <td className="px-5 py-4 font-semibold text-slate-900">{formatCurrency(doctor.fee)}</td>
                          <td className="px-5 py-4"><StatusBadge value={doctor.availability} /></td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => deleteDoctor(doctor)}
                              disabled={deletingId === id}
                              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Icon icon={Trash2} />
                              {deletingId === id ? 'Deleting...' : 'Delete'}
                            </button>
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
