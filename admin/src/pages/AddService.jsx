import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  ImagePlus,
  ListChecks,
  LoaderCircle,
  Plus,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react'
import { api, appendFormFields } from '../lib/api'
import { formatCurrency } from '../lib/format'

const initialForm = {
  name: '',
  shortDescription: '',
  about: '',
  price: '',
  availability: 'Available',
  imageUrl: '',
}

export default function AddService() {
  const [form, setForm] = useState(initialForm)
  const [instructions, setInstructions] = useState([{ id: 1, text: '' }])
  const [schedule, setSchedule] = useState({})
  const [slotDate, setSlotDate] = useState('')
  const [slotTime, setSlotTime] = useState('')
  const [slotError, setSlotError] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileInputRef = useRef(null)
  const formRef = useRef(null)
  const objectUrlRef = useRef('')
  const instructionIdRef = useRef(2)

  useEffect(() => () => revokePreviewUrl(objectUrlRef), [])

  const scheduleEntries = Object.entries(schedule).sort(([first], [second]) => first.localeCompare(second))
  const totalSlots = scheduleEntries.reduce((total, [, slots]) => total + slots.length, 0)
  const cleanInstructions = instructions.map((item) => item.text.trim()).filter(Boolean)
  const previewImage = imagePreview || form.imageUrl.trim()

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    clearFieldError(name)
    if (message.type === 'error') setMessage({ type: '', text: '' })
  }

  function clearFieldError(name) {
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function selectImage(event) {
    const file = event.target.files?.[0] || null
    clearFieldError('image')
    if (!file) {
      clearImage()
      return
    }

    const imageError = validateImage(file)
    if (imageError) {
      clearImage()
      setErrors((current) => ({ ...current, image: imageError }))
      return
    }

    revokePreviewUrl(objectUrlRef)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setImage(file)
    setImagePreview(url)
  }

  function clearImage() {
    revokePreviewUrl(objectUrlRef)
    setImage(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function updateInstruction(id, value) {
    setInstructions((current) => current.map((item) => item.id === id ? { ...item, text: value } : item))
  }

  function addInstruction() {
    if (instructions.length >= 10) return
    setInstructions((current) => [...current, { id: instructionIdRef.current, text: '' }])
    instructionIdRef.current += 1
  }

  function removeInstruction(id) {
    setInstructions((current) => {
      if (current.length === 1) return [{ ...current[0], text: '' }]
      return current.filter((item) => item.id !== id)
    })
  }

  function addScheduleSlot() {
    if (!slotDate || !slotTime) {
      setSlotError('Choose both a date and a time.')
      return
    }

    const label = toTwelveHourTime(slotTime)
    if ((schedule[slotDate] || []).includes(label)) {
      setSlotError('That time is already available on this date.')
      return
    }

    setSchedule((current) => ({
      ...current,
      [slotDate]: [...(current[slotDate] || []), label].sort(compareTimeSlots),
    }))
    setSlotError('')
    setSlotTime('')
  }

  function removeScheduleSlot(date, slot) {
    setSchedule((current) => {
      const remaining = current[date].filter((item) => item !== slot)
      const next = { ...current }
      if (remaining.length) next[date] = remaining
      else delete next[date]
      return next
    })
  }

  function resetForm() {
    setForm(initialForm)
    setInstructions([{ id: 1, text: '' }])
    instructionIdRef.current = 2
    setSchedule({})
    setSlotDate('')
    setSlotTime('')
    setSlotError('')
    setErrors({})
    setMessage({ type: '', text: '' })
    clearImage()
  }

  async function submit(event) {
    event.preventDefault()
    const nextErrors = validateForm(form, image)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setMessage({ type: 'error', text: 'Please review the highlighted fields before saving.' })
      window.requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    setSaving(true)
    setErrors({})
    setMessage({ type: '', text: '' })

    try {
      const formData = new FormData()
      appendFormFields(formData, trimValues(form))
      formData.set('instructions', JSON.stringify(cleanInstructions))
      formData.set('slots', JSON.stringify(schedule))
      if (image) formData.set('image', image)

      const response = await api.createService(formData)
      const createdName = response.data?.name || form.name.trim()
      resetForm()
      setMessage({ type: 'success', text: `${createdName} was created successfully and is ready to configure or publish.` })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError.message || 'Unable to create the service. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="admin-page min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="page-heading mb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Service management</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Add a service</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Create a bookable care service with pricing, patient guidance, imagery, and available appointment slots.</p>
        </header>

        {message.text && <FormMessage message={message} onClose={() => setMessage({ type: '', text: '' })} />}

        <form ref={formRef} onSubmit={submit} noValidate className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <FormSection icon={Stethoscope} title="Service details" subtitle="Core information patients will see before booking.">
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Service name"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  error={errors.name}
                  placeholder="Cardiac health screening"
                  required
                />
                <Field
                  label="Price"
                  name="price"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={form.price}
                  onChange={updateField}
                  error={errors.price}
                  placeholder="2500"
                  prefix="৳"
                  required
                />
                <SelectField label="Availability" name="availability" value={form.availability} onChange={updateField}>
                  <option value="Available">Available</option>
                  <option value="Unavailable">Unavailable</option>
                </SelectField>
                <Field
                  label="Short description"
                  name="shortDescription"
                  value={form.shortDescription}
                  onChange={updateField}
                  error={errors.shortDescription}
                  placeholder="A concise overview shown on service cards"
                  maxLength={160}
                  hint={`${form.shortDescription.length}/160`}
                  required
                  className="md:col-span-2"
                />
              </div>
              <TextArea
                label="Full description"
                name="about"
                value={form.about}
                onChange={updateField}
                placeholder="Explain what the service includes, who it is for, and what patients should expect."
                maxLength={1000}
                hint={`${form.about.length}/1000 characters`}
                className="mt-5"
              />
            </FormSection>

            <FormSection icon={ImagePlus} title="Service image" subtitle="Upload a visual or provide a hosted image URL. Uploaded files take priority.">
              <div className="grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
                <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                  {previewImage ? (
                    <PreviewImage key={previewImage} src={previewImage} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-400"><ImagePlus className="mx-auto" size={28} /><p className="mt-2 text-xs font-semibold">Image preview</p></div>
                  )}
                  {image && (
                    <button type="button" onClick={clearImage} aria-label="Remove selected image" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-950/75 text-white backdrop-blur"><X size={15} /></button>
                  )}
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Upload image</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={selectImage}
                      aria-invalid={Boolean(errors.image)}
                      className="block w-full rounded-xl border border-slate-200 bg-white text-sm text-slate-600 file:mr-4 file:border-0 file:bg-emerald-50 file:px-4 file:py-3 file:text-sm file:font-bold file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <p className={`mt-1.5 text-xs ${errors.image ? 'text-rose-600' : 'text-slate-400'}`}>{errors.image || 'PNG, JPG, or WebP up to 5 MB.'}</p>
                  </label>
                  <Field
                    label="Or image URL"
                    name="imageUrl"
                    type="url"
                    value={form.imageUrl}
                    onChange={updateField}
                    error={errors.imageUrl}
                    placeholder="https://example.com/service.jpg"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection icon={ListChecks} title="Patient instructions" subtitle="Add any preparation or aftercare guidance patients should receive.">
              <div className="space-y-3">
                {instructions.map((instruction, index) => (
                  <div key={instruction.id} className="flex items-start gap-2">
                    <span className="mt-3 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">{index + 1}</span>
                    <input
                      value={instruction.text}
                      onChange={(event) => updateInstruction(instruction.id, event.target.value)}
                      maxLength={180}
                      placeholder="For example: Fast for 8 hours before your appointment"
                      aria-label={`Instruction ${index + 1}`}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                    />
                    <button type="button" onClick={() => removeInstruction(instruction.id)} aria-label={`Remove instruction ${index + 1}`} className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">{cleanInstructions.length} of 10 instructions added</p>
                <button type="button" onClick={addInstruction} disabled={instructions.length >= 10} className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={15} /> Add instruction</button>
              </div>
            </FormSection>

            <FormSection icon={CalendarDays} title="Booking schedule" subtitle="Add the dates and times patients can select for this service.">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Date</span>
                  <input
                    type="date"
                    value={slotDate}
                    min={localDateKey(new Date())}
                    onChange={(event) => { setSlotDate(event.target.value); setSlotError('') }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Time</span>
                  <input
                    type="time"
                    value={slotTime}
                    onChange={(event) => { setSlotTime(event.target.value); setSlotError('') }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />
                </label>
                <button type="button" onClick={addScheduleSlot} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"><Plus size={17} /> Add slot</button>
              </div>
              {slotError && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{slotError}</p>}

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">{totalSlots} booking {totalSlots === 1 ? 'slot' : 'slots'}</p>
                  {totalSlots > 0 && <button type="button" onClick={() => setSchedule({})} className="text-xs font-bold text-rose-600 hover:text-rose-700">Clear schedule</button>}
                </div>
                {scheduleEntries.length === 0 ? (
                  <div className="px-4 py-8 text-center"><Clock3 className="mx-auto text-slate-300" size={24} /><p className="mt-2 text-sm font-semibold text-slate-500">No service slots added</p></div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {scheduleEntries.map(([date, slots]) => (
                      <div key={date} className="grid gap-3 px-4 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <div><p className="text-sm font-bold text-slate-800">{formatScheduleDate(date)}</p><p className="mt-0.5 text-xs text-slate-400">{slots.length} {slots.length === 1 ? 'slot' : 'slots'}</p></div>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot) => (
                            <span key={slot} className="inline-flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                              {slot}
                              <button type="button" onClick={() => removeScheduleSlot(date, slot)} aria-label={`Remove ${slot} on ${date}`} className="grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={12} /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </FormSection>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-28">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-linear-to-br from-emerald-100 to-teal-50">
                {previewImage ? <PreviewImage key={previewImage} src={previewImage} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-emerald-600"><Stethoscope size={38} /></div>}
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${form.availability === 'Available' ? 'bg-white text-emerald-700' : 'bg-slate-800 text-white'}`}>{form.availability}</span>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Service preview</p>
                <h2 className="mt-2 truncate text-xl font-bold text-slate-950">{form.name.trim() || 'Service name'}</h2>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{form.shortDescription.trim() || 'Your short service description will appear here.'}</p>
                <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                  <div><p className="text-xs text-slate-400">Price</p><p className="mt-0.5 text-lg font-bold text-slate-900">{form.price === '' ? 'Not set' : formatCurrency(form.price)}</p></div>
                  <div className="text-right"><p className="text-xs text-slate-400">Schedule</p><p className="mt-0.5 text-sm font-bold text-slate-700">{totalSlots} {totalSlots === 1 ? 'slot' : 'slots'}</p></div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Ready to create?</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Required fields are marked with an asterisk. Schedule and instructions can be added later.</p>
              <button type="submit" disabled={saving} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
                {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}{saving ? 'Creating service...' : 'Create service'}
              </button>
              <button type="button" onClick={resetForm} disabled={saving} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"><Trash2 size={15} /> Clear form</button>
            </section>
          </aside>
        </form>
      </div>
    </main>
  )
}

function FormSection({ icon: SectionIcon, title, subtitle, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><SectionIcon size={19} /></span>
        <div><h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

function Field({ label, error, hint, className = '', prefix, required, ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
        <span>{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>
        {hint && <span className="text-xs font-medium text-slate-400">{hint}</span>}
      </span>
      <span className="relative block">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{prefix}</span>}
        <input
          {...props}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${props.name}-error` : undefined}
          className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${prefix ? 'pl-8' : ''} ${error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-50' : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-50'}`}
        />
      </span>
      {error && <span id={`${props.name}-error`} className="mt-1.5 block text-xs font-semibold text-rose-600">{error}</span>}
    </label>
  )
}

function SelectField({ label, children, ...props }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><select {...props} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50">{children}</select></label>
}

function TextArea({ label, hint, className = '', ...props }) {
  return <label className={`block ${className}`}><span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-700"><span>{label}</span>{hint && <span className="text-xs font-medium text-slate-400">{hint}</span>}</span><textarea {...props} rows={6} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50" /></label>
}

function FormMessage({ message, onClose }) {
  const success = message.type === 'success'
  return (
    <div role="alert" className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
      {success ? <CheckCircle2 className="mt-0.5 shrink-0" size={19} /> : <X className="mt-0.5 shrink-0" size={19} />}
      <p className="flex-1 font-semibold leading-6">{message.text}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss message" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-black/5"><X size={15} /></button>
    </div>
  )
}

function PreviewImage({ src, className }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className="grid h-full w-full place-items-center bg-slate-100 text-slate-400"><ImagePlus size={26} /></div>
  return <img src={src} alt="Service preview" onError={() => setFailed(true)} className={className} />
}

function validateForm(form, image) {
  const errors = {}
  if (form.name.trim().length < 2) errors.name = 'Enter a service name.'
  if (!form.shortDescription.trim()) errors.shortDescription = 'Enter a short description.'
  if (form.price === '') errors.price = 'Enter the service price.'
  else if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) errors.price = 'Price must be zero or greater.'
  if (form.imageUrl.trim() && !isHttpUrl(form.imageUrl.trim())) errors.imageUrl = 'Enter a valid http(s) image URL.'
  const imageError = validateImage(image)
  if (imageError) errors.image = imageError
  return errors
}

function validateImage(file) {
  if (!file) return ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a PNG, JPG, or WebP image.'
  if (file.size > 5 * 1024 * 1024) return 'Image size must be 5 MB or less.'
  return ''
}

function trimValues(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function toTwelveHourTime(value) {
  const [rawHour, minute] = value.split(':')
  const hour = Number(rawHour)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${suffix}`
}

function compareTimeSlots(first, second) {
  return timeSlotMinutes(first) - timeSlotMinutes(second)
}

function timeSlotMinutes(value) {
  const [time, suffix] = value.split(' ')
  const [rawHour, minute] = time.split(':').map(Number)
  return (rawHour % 12 + (suffix === 'PM' ? 12 : 0)) * 60 + minute
}

function formatScheduleDate(value) {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('en-BD', { weekday: 'short', month: 'short', day: 'numeric' })
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function revokePreviewUrl(ref) {
  if (!ref.current) return
  URL.revokeObjectURL(ref.current)
  ref.current = ''
}
