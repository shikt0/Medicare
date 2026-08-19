import React, { useState } from 'react'
import { Save } from 'lucide'
import { api, appendFormFields } from '../lib/api'
import { ErrorMessage, PageHeader, Panel, PanelHeader, SuccessMessage } from '../components/AdminUi'
import Icon from '../components/Icon'

const initialForm = {
  name: '',
  email: '',
  password: '',
  specialization: '',
  fee: '',
  availability: 'Available',
  experience: '',
  qualifications: '',
  location: '',
  patients: '',
  rating: '',
  success: '',
  imageUrl: '',
  about: '',
  schedule: '{}',
}

export default function AddDoctor() {
  const [form, setForm] = useState(initialForm)
  const [image, setImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      JSON.parse(form.schedule || '{}')
      const formData = new FormData()
      appendFormFields(formData, form)
      if (image) formData.append('image', image)

      await api.createDoctor(formData)
      setForm(initialForm)
      setImage(null)
      setSuccess('Doctor created successfully.')
    } catch (err) {
      setError(err.message || 'Unable to create doctor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 font-serif">
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Add Doctor" subtitle="Create a provider profile that can receive appointments." />
        <div className="space-y-4">
          <ErrorMessage message={error} />
          <SuccessMessage message={success} />
          <Panel>
            <PanelHeader title="Doctor Details" subtitle="Name, login, clinical profile, and scheduling metadata." />
            <form onSubmit={submit} className="grid gap-5 p-5 md:grid-cols-2">
              <Field label="Name" name="name" value={form.name} onChange={updateField} required />
              <Field label="Email" name="email" type="email" value={form.email} onChange={updateField} required />
              <Field label="Password" name="password" type="password" value={form.password} onChange={updateField} required />
              <Field label="Specialization" name="specialization" value={form.specialization} onChange={updateField} />
              <Field label="Fee" name="fee" type="number" min="0" value={form.fee} onChange={updateField} />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Availability
                <select
                  name="availability"
                  value={form.availability}
                  onChange={updateField}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option>Available</option>
                  <option>Unavailable</option>
                </select>
              </label>
              <Field label="Experience" name="experience" value={form.experience} onChange={updateField} placeholder="8 years" />
              <Field label="Qualifications" name="qualifications" value={form.qualifications} onChange={updateField} placeholder="MBBS, MD" />
              <Field label="Location" name="location" value={form.location} onChange={updateField} />
              <Field label="Patients" name="patients" value={form.patients} onChange={updateField} placeholder="1,200+" />
              <Field label="Rating" name="rating" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={updateField} />
              <Field label="Success Rate" name="success" value={form.success} onChange={updateField} placeholder="98%" />
              <Field label="Image URL" name="imageUrl" value={form.imageUrl} onChange={updateField} className="md:col-span-2" />
              <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
                Image Upload
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-700"
                />
              </label>
              <Textarea label="About" name="about" value={form.about} onChange={updateField} className="md:col-span-2" />
              <Textarea
                label="Schedule JSON"
                name="schedule"
                value={form.schedule}
                onChange={updateField}
                className="md:col-span-2"
                rows={5}
              />
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon icon={Save} />
                  {saving ? 'Saving...' : 'Save Doctor'}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </main>
  )
}

function Field({ label, className = '', ...props }) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}>
      {label}
      <input
        {...props}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  )
}

function Textarea({ label, className = '', rows = 4, ...props }) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}>
      {label}
      <textarea
        {...props}
        rows={rows}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  )
}
