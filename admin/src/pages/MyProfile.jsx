import { useEffect, useRef, useState } from 'react'
import { Camera, ImageUp, LoaderCircle, RotateCcw, Save, Trash2, UserRound } from 'lucide-react'
import { ErrorMessage, LoadingState, PageHeader, Panel, SuccessMessage } from '../components/AdminUi'
import { api } from '../lib/api'

const empty = { name: '', phone: '', address: '', emergencyName: '', emergencyRelationship: '', emergencyPhone: '' }
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 5 * 1024 * 1024

export default function MyProfile() {
  const fileInput = useRef(null)
  const [form, setForm] = useState(empty)
  const [record, setRecord] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [removeImage, setRemoveImage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let current = true
    api.getMyProfile()
      .then((data) => {
        if (!current) return
        setRecord(data)
        setForm(formFromRecord(data))
      })
      .catch((loadError) => { if (current) setError(loadError.message) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
    setSuccess('')
  }

  function chooseImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!allowedImageTypes.has(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > maxImageBytes) {
      setError('Profile image must be 5 MB or smaller.')
      return
    }

    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setRemoveImage(false)
    setError('')
    setSuccess('')
  }

  function removeSelectedImage() {
    if (imageFile) {
      setImageFile(null)
      setPreviewUrl('')
      setRemoveImage(false)
      setError('')
      setSuccess('')
      return
    }
    setImageFile(null)
    setPreviewUrl('')
    setRemoveImage(true)
    setError('')
    setSuccess('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Full name is required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = new FormData()
      payload.append('name', form.name.trim())
      payload.append('phone', form.phone.trim())
      payload.append('address', form.address.trim())
      payload.append('emergencyContact', JSON.stringify({
        name: form.emergencyName.trim(),
        relationship: form.emergencyRelationship.trim(),
        phone: form.emergencyPhone.trim(),
      }))
      if (imageFile) payload.append('image', imageFile)
      if (removeImage) payload.append('removeImage', 'true')

      const response = await api.updateMyProfile(payload)
      setRecord(response.data)
      setForm(formFromRecord(response.data))
      setImageFile(null)
      setPreviewUrl('')
      setRemoveImage(false)
      setSuccess(response.message || 'Profile updated')
    } catch (saveError) {
      setError(saveError.message || 'Unable to update your profile.')
    } finally {
      setSaving(false)
    }
  }

  const displayedImage = previewUrl || (!removeImage ? record?.imageUrl : '')

  return (
    <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader title="My Profile" subtitle="Maintain your profile image and contact details. Role and employment fields are managed by administration." />
        <ErrorMessage message={error} />
        <SuccessMessage message={success} />

        {loading ? <Panel><LoadingState /></Panel> : (
          <form onSubmit={submit}>
            <Panel className="overflow-hidden">
              <section className="border-b border-slate-100 p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <span className="relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-white bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-950/10">
                    {displayedImage ? <img src={displayedImage} alt={`${record?.name || 'Staff'} profile`} className="h-full w-full object-cover" /> : <UserRound size={39} />}
                    {imageFile && <span className="absolute inset-x-0 bottom-0 bg-emerald-950/75 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-white">New image</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold uppercase tracking-[.14em] text-emerald-700">Profile image</p>
                    <h2 className="mt-1 text-xl font-extrabold text-slate-900">{record?.name}</h2>
                    <p className="mt-1 text-sm capitalize text-slate-500">{record?.employeeId} · {record?.role} · {record?.department || 'General'}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-400">JPG, PNG, or WebP. Maximum file size 5 MB. A new upload replaces the previous image.</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <input ref={fileInput} id="staff-profile-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} className="sr-only" />
                  <label htmlFor="staff-profile-image" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm hover:bg-emerald-800"><Camera size={16} /> {displayedImage ? 'Change image' : 'Upload image'}</label>
                  {displayedImage && <button type="button" onClick={removeSelectedImage} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100"><Trash2 size={15} /> {imageFile ? 'Cancel new image' : 'Remove image'}</button>}
                  {removeImage && record?.imageUrl && <button type="button" onClick={() => setRemoveImage(false)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"><RotateCcw size={15} /> Undo removal</button>}
                  {imageFile && <span className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 text-xs font-semibold text-sky-700"><ImageUp size={15} /><span className="truncate">{imageFile.name}</span></span>}
                </div>
              </section>

              <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                {[['Full name', 'name', 'text'], ['Phone', 'phone', 'tel'], ['Address', 'address', 'text'], ['Emergency contact', 'emergencyName', 'text'], ['Relationship', 'emergencyRelationship', 'text'], ['Emergency phone', 'emergencyPhone', 'tel']].map(([label, name, type]) => (
                  <label key={name} className={name === 'address' ? 'sm:col-span-2' : ''}>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
                    <input name={name} type={type} value={form[name]} onChange={update} required={name === 'name'} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-emerald-500" />
                  </label>
                ))}
              </div>

              <footer className="flex justify-end border-t border-slate-100 bg-slate-50 p-4 sm:px-6">
                <button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving...' : 'Save profile'}</button>
              </footer>
            </Panel>
          </form>
        )}
      </div>
    </main>
  )
}

function formFromRecord(data = {}) {
  return {
    name: data.name || '',
    phone: data.phone || '',
    address: data.address || '',
    emergencyName: data.emergencyContact?.name || '',
    emergencyRelationship: data.emergencyContact?.relationship || '',
    emergencyPhone: data.emergencyContact?.phone || '',
  }
}
