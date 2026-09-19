import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Plus,
  Stethoscope,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { api, appendFormFields } from '../lib/api'
import { formatCurrency } from '../lib/format'

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
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
}

const specializations = [
  'Cardiology',
  'Dentistry',
  'Dermatology',
  'General Medicine',
  'Gynecology',
  'Neurology',
  'Ophthalmology',
  'Orthopedics',
  'Pediatrics',
  'Psychiatry',
]

const WEEK_DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
]

export default function AddDoctor() {
  const [form, setForm] = useState(initialForm)
  const [schedule, setSchedule] = useState({})
  const [slotDay, setSlotDay] = useState('monday')
  const [slotTime, setSlotTime] = useState('')
  const [slotError, setSlotError] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showPassword, setShowPassword] = useState(false)
  const formRef = useRef(null)
  const fileInputRef = useRef(null)
  const objectUrlRef = useRef('')

  useEffect(() => () => revokePreviewUrl(objectUrlRef), [])

  const scheduleEntries = WEEK_DAYS.map((day) => [day.key, schedule[day.key] || []]).filter(([, slots]) => slots.length)
  const totalSlots = scheduleEntries.reduce((total, [, slots]) => total + slots.length, 0)
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
      setErrors((current) => ({ ...current, image: imageError }))
      event.target.value = ''
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

  function addScheduleSlot() {
    if (!slotDay || !slotTime) {
      setSlotError('Choose both a weekday and a time.')
      return
    }

    const label = toTwelveHourTime(slotTime)
    const existingSlots = schedule[slotDay] || []
    if (existingSlots.includes(label)) {
      setSlotError('That time is already in the weekly schedule for this day.')
      return
    }

    setSchedule((current) => ({
      ...current,
      [slotDay]: [...(current[slotDay] || []), label].sort(compareTimeSlots),
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

  function clearSchedule() {
    setSchedule({})
    setSlotError('')
  }

  function clearScheduleDay(day) {
    setSchedule((current) => {
      const next = { ...current }
      delete next[day]
      return next
    })
  }

  function resetForm() {
    setForm(initialForm)
    setSchedule({})
    setSlotDay('monday')
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
      window.requestAnimationFrame(() => {
        const firstInvalid = formRef.current?.querySelector('[aria-invalid="true"]')
        firstInvalid?.focus()
      })
      return
    }

    setSaving(true)
    setErrors({})
    setMessage({ type: '', text: '' })

    try {
      const formData = new FormData()
      const doctorFields = { ...form }
      delete doctorFields.confirmPassword
      appendFormFields(formData, trimFormValues(doctorFields))
      formData.set('schedule', JSON.stringify(schedule))
      if (image) formData.set('image', image)

      const response = await api.createDoctor(formData)
      const doctorName = response.data?.name || form.name.trim()
      resetForm()
      setMessage({
        type: 'success',
        text: `${doctorName} was added successfully and can now receive appointments.`,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to add the doctor. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="admin-page min-h-[calc(100vh-5rem)] bg-slate-50 px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="page-heading mb-7">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-600">Provider management</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Add a doctor</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Create the doctor’s account, public profile, consultation fee, and recurring weekly appointment slots.
          </p>
        </header>

        {message.text && <FormMessage message={message} onClose={() => setMessage({ type: '', text: '' })} />}

        <form ref={formRef} onSubmit={submit} noValidate className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            <FormSection
              icon={UserRound}
              title="Profile details"
              subtitle="Information patients will see while choosing a doctor."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Full name"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  error={errors.name}
                  placeholder="Dr. Samira Rahman"
                  autoComplete="name"
                  required
                />
                <Field
                  label="Specialization"
                  name="specialization"
                  value={form.specialization}
                  onChange={updateField}
                  error={errors.specialization}
                  placeholder="Cardiology"
                  list="doctor-specializations"
                  required
                />
                <datalist id="doctor-specializations">
                  {specializations.map((item) => <option key={item} value={item} />)}
                </datalist>
                <Field
                  label="Experience"
                  name="experience"
                  value={form.experience}
                  onChange={updateField}
                  placeholder="8 years"
                />
                <Field
                  label="Qualifications"
                  name="qualifications"
                  value={form.qualifications}
                  onChange={updateField}
                  placeholder="MBBS, MD"
                />
                <Field
                  label="Location"
                  name="location"
                  value={form.location}
                  onChange={updateField}
                  placeholder="Dhanmondi, Dhaka"
                  autoComplete="street-address"
                />
                <SelectField label="Availability" name="availability" value={form.availability} onChange={updateField}>
                  <option value="Available">Available</option>
                  <option value="Unavailable">Unavailable</option>
                </SelectField>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-3">
                <Field
                  label="Consultation fee"
                  name="fee"
                  type="number"
                  min="0"
                  step="1"
                  value={form.fee}
                  onChange={updateField}
                  error={errors.fee}
                  placeholder="1200"
                  inputMode="numeric"
                  prefix="৳"
                />
                <Field
                  label="Rating"
                  name="rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={form.rating}
                  onChange={updateField}
                  error={errors.rating}
                  placeholder="4.8"
                />
                <Field
                  label="Success rate"
                  name="success"
                  value={form.success}
                  onChange={updateField}
                  placeholder="98%"
                />
                <Field
                  label="Patients served"
                  name="patients"
                  value={form.patients}
                  onChange={updateField}
                  placeholder="1,200+"
                  className="md:col-span-3"
                />
              </div>

              <TextArea
                label="About the doctor"
                name="about"
                value={form.about}
                onChange={updateField}
                placeholder="Briefly describe clinical interests, experience, and approach to patient care."
                hint={`${form.about.length}/600 characters`}
                maxLength={600}
                className="mt-5"
              />
            </FormSection>

            <FormSection
              icon={Mail}
              title="Account access"
              subtitle="These credentials are used for the doctor’s account."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  error={errors.email}
                  placeholder="doctor@medicare.com"
                  autoComplete="email"
                  className="md:col-span-2"
                  required
                />
                <PasswordField
                  label="Password"
                  name="password"
                  value={form.password}
                  onChange={updateField}
                  error={errors.password}
                  visible={showPassword}
                  setVisible={setShowPassword}
                  autoComplete="new-password"
                />
                <PasswordField
                  label="Confirm password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={updateField}
                  error={errors.confirmPassword}
                  visible={showPassword}
                  setVisible={setShowPassword}
                  autoComplete="new-password"
                />
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <LockKeyhole size={14} /> Use at least 6 characters and share the password securely.
              </p>
            </FormSection>

            <FormSection
              icon={ImagePlus}
              title="Profile image"
              subtitle="Upload an image or provide a hosted image URL. Uploaded files take priority."
            >
              <div className="grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
                <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Doctor preview"
                      className="h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="text-center text-slate-400">
                      <ImagePlus className="mx-auto" size={28} />
                      <p className="mt-2 text-xs font-semibold">Image preview</p>
                    </div>
                  )}
                  {image && (
                    <button
                      type="button"
                      onClick={clearImage}
                      aria-label="Remove selected image"
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-950/75 text-white backdrop-blur"
                    >
                      <X size={15} />
                    </button>
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
                    <p className={`mt-1.5 text-xs ${errors.image ? 'text-rose-600' : 'text-slate-400'}`}>
                      {errors.image || 'PNG, JPG, or WebP up to 5 MB.'}
                    </p>
                  </label>
                  <Field
                    label="Or image URL"
                    name="imageUrl"
                    type="url"
                    value={form.imageUrl}
                    onChange={updateField}
                    error={errors.imageUrl}
                    placeholder="https://example.com/doctor.jpg"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              icon={CalendarDays}
              title="Weekly appointment schedule"
              subtitle="Set weekday times once. They repeat automatically every week until canceled."
            >
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Weekday</span>
                  <select
                    value={slotDay}
                    onChange={(event) => {
                      setSlotDay(event.target.value)
                      setSlotError('')
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  >
                    {WEEK_DAYS.map((day) => <option key={day.key} value={day.key}>{day.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-slate-700">Time</span>
                  <input
                    type="time"
                    value={slotTime}
                    onChange={(event) => {
                      setSlotTime(event.target.value)
                      setSlotError('')
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />
                </label>
                <button
                  type="button"
                  onClick={addScheduleSlot}
                  className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  <Plus size={17} /> Add weekly slot
                </button>
              </div>

              {slotError && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{slotError}</p>}

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">{totalSlots} recurring appointment {totalSlots === 1 ? 'slot' : 'slots'}</p>
                  {totalSlots > 0 && (
                    <button type="button" onClick={clearSchedule} className="text-xs font-bold text-rose-600 hover:text-rose-700">
                      Clear schedule
                    </button>
                  )}
                </div>

                {scheduleEntries.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Clock3 className="mx-auto text-slate-300" size={24} />
                    <p className="mt-2 text-sm font-semibold text-slate-500">No weekly appointment slots added</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {scheduleEntries.map(([day, slots]) => (
                      <div key={day} className="grid gap-3 px-4 py-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{formatScheduleDay(day)}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{slots.length} {slots.length === 1 ? 'slot' : 'slots'}</p>
                          <button type="button" onClick={() => clearScheduleDay(day)} className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-700">Cancel day</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {slots.map((slot) => (
                            <span key={slot} className="inline-flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                              {slot}
                              <button
                                type="button"
                                onClick={() => removeScheduleSlot(day, slot)}
                                aria-label={`Cancel ${slot} every ${formatScheduleDay(day)}`}
                                className="grid h-5 w-5 place-items-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <X size={12} />
                              </button>
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
              <div className="bg-linear-to-br from-emerald-700 to-teal-600 px-5 py-6 text-white">
                <div className="flex items-center gap-3">
                  {previewImage ? (
                    <img src={previewImage} alt="" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/30" />
                  ) : (
                    <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                      <Stethoscope size={26} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{form.name.trim() || 'Doctor name'}</p>
                    <p className="mt-1 truncate text-sm text-emerald-50">{form.specialization.trim() || 'Specialization'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <PreviewItem icon={MapPin} label="Location" value={form.location.trim() || 'Not provided'} />
                <PreviewItem icon={WalletCards} label="Consultation fee" value={form.fee === '' ? 'Not set' : formatCurrency(form.fee)} />
                <PreviewItem icon={CalendarDays} label="Weekly schedule" value={`${totalSlots} recurring ${totalSlots === 1 ? 'slot' : 'slots'}`} />
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                  <span className="text-xs font-bold text-slate-500">Profile status</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${form.availability === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${form.availability === 'Available' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {form.availability}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Ready to publish?</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Required fields are marked with an asterisk. You can add or update optional details later.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}
                {saving ? 'Adding doctor...' : 'Add doctor'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
              >
                <Trash2 size={15} /> Clear form
              </button>
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
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
          <SectionIcon size={19} />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

function Field({ label, error, className = '', prefix, required, ...props }) {
  const input = (
    <input
      {...props}
      required={required}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${props.name}-error` : undefined}
      className={`h-11 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
        error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-50' : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-50'
      } ${prefix ? 'pl-8' : ''}`}
    />
  )

  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}{required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {prefix ? (
        <span className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">{prefix}</span>
          {input}
        </span>
      ) : input}
      {error && <span id={`${props.name}-error`} className="mt-1.5 block text-xs font-semibold text-rose-600">{error}</span>}
    </label>
  )
}

function PasswordField({ label, visible, setVisible, error, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}<span className="ml-1 text-rose-500">*</span></span>
      <span className="relative block">
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${props.name}-error` : undefined}
          className={`h-11 w-full rounded-xl border bg-white px-3 pr-11 text-sm text-slate-800 outline-none transition focus:ring-4 ${
            error ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-50' : 'border-slate-200 focus:border-emerald-400 focus:ring-emerald-50'
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {error && <span id={`${props.name}-error`} className="mt-1.5 block text-xs font-semibold text-rose-600">{error}</span>}
    </label>
  )
}

function SelectField({ label, children, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <select
        {...props}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
      >
        {children}
      </select>
    </label>
  )
}

function TextArea({ label, hint, className = '', ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-700">
        {label}
        {hint && <span className="text-xs font-medium text-slate-400">{hint}</span>}
      </span>
      <textarea
        {...props}
        rows={5}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
      />
    </label>
  )
}

function FormMessage({ message, onClose }) {
  const success = message.type === 'success'
  return (
    <div
      role="alert"
      className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm ${success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
    >
      {success ? <CheckCircle2 className="mt-0.5 shrink-0" size={19} /> : <X className="mt-0.5 shrink-0" size={19} />}
      <p className="flex-1 font-semibold leading-6">{message.text}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss message" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-black/5">
        <X size={15} />
      </button>
    </div>
  )
}

function PreviewItem({ icon: ItemIcon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
        <ItemIcon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function validateForm(form, image) {
  const errors = {}
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (form.name.trim().length < 2) errors.name = 'Enter the doctor’s full name.'
  if (!form.specialization.trim()) errors.specialization = 'Enter a specialization.'
  if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (form.password.length < 6) errors.password = 'Use at least 6 characters.'
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.'
  if (form.fee !== '' && finiteNumber(form.fee) < 0) errors.fee = 'Fee cannot be negative.'
  if (form.rating !== '' && (finiteNumber(form.rating) < 0 || finiteNumber(form.rating) > 5)) {
    errors.rating = 'Rating must be between 0 and 5.'
  }
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

function trimFormValues(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    typeof value === 'string' && key !== 'password' ? value.trim() : value,
  ]))
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
  const twelveHour = hour % 12 || 12
  return `${String(twelveHour).padStart(2, '0')}:${minute} ${suffix}`
}

function compareTimeSlots(first, second) {
  return timeSlotMinutes(first) - timeSlotMinutes(second)
}

function timeSlotMinutes(value) {
  const [time, suffix] = value.split(' ')
  const [rawHour, minute] = time.split(':').map(Number)
  const hour = (rawHour % 12) + (suffix === 'PM' ? 12 : 0)
  return hour * 60 + minute
}

function formatScheduleDay(value) {
  return WEEK_DAYS.find((day) => day.key === value)?.label || value
}

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function revokePreviewUrl(ref) {
  if (!ref.current) return
  URL.revokeObjectURL(ref.current)
  ref.current = ''
}
