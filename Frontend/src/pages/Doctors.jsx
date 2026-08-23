import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, MapPin, Search, SlidersHorizontal, Star, Stethoscope, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { EmptyState, ErrorState, ImageWithFallback, LoadingGrid, PageIntro } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { cleanSchedule, formatCurrency, getId, isAvailable } from '../lib/format'

export default function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [specialization, setSpecialization] = useState('All')
  const [availability, setAvailability] = useState('All')
  const [sort, setSort] = useState('recommended')

  const loadDoctors = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await patientApi.getDoctors({ limit: 500 })
      setDoctors(payload.data || payload.doctors || [])
    } catch (loadError) {
      setError(loadError.message || 'Unable to load doctors.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(loadDoctors, 0)
    return () => window.clearTimeout(timeout)
  }, [loadDoctors])

  const specializations = useMemo(() => ['All', ...new Set(doctors.map((doctor) => doctor.specialization).filter(Boolean))], [doctors])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const result = doctors.filter((doctor) => {
      const matchesQuery = !keyword || [doctor.name, doctor.specialization, doctor.location, doctor.qualifications]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
      const matchesSpecialization = specialization === 'All' || doctor.specialization === specialization
      const matchesAvailability = availability === 'All' || (availability === 'Available' ? isAvailable(doctor) : !isAvailable(doctor))
      return matchesQuery && matchesSpecialization && matchesAvailability
    })

    return [...result].sort((first, second) => {
      if (sort === 'fee-low') return Number(first.fee || 0) - Number(second.fee || 0)
      if (sort === 'rating') return Number(second.rating || 0) - Number(first.rating || 0)
      if (sort === 'name') return String(first.name || '').localeCompare(String(second.name || ''))
      return Number(isAvailable(second)) - Number(isAvailable(first)) || Number(second.rating || 0) - Number(first.rating || 0)
    })
  }, [availability, doctors, query, sort, specialization])

  function clearFilters() {
    setQuery('')
    setSpecialization('All')
    setAvailability('All')
    setSort('recommended')
  }

  const hasFilters = query || specialization !== 'All' || availability !== 'All' || sort !== 'recommended'

  return (
    <div className="patient-site">
      <Navbar />
      <main className="patient-page">
        <div className="patient-page__inner">
          <PageIntro kicker="Clinical directory" title="Find your doctor" description="Explore verified profiles, availability, consultation fees, and upcoming appointment times." />

          <section className="patient-filter-panel" aria-label="Doctor filters">
            <label className="patient-search-field"><Search size={18} /><span className="sr-only">Search doctors</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, specialty, or location" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
            <label><span className="sr-only">Specialization</span><select value={specialization} onChange={(event) => setSpecialization(event.target.value)}><option value="All">All specialties</option>{specializations.slice(1).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span className="sr-only">Availability</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="All">Any availability</option><option value="Available">Available</option><option value="Unavailable">Unavailable</option></select></label>
            <label className="patient-sort-field"><SlidersHorizontal size={15} /><span className="sr-only">Sort doctors</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="rating">Highest rated</option><option value="fee-low">Lowest fee</option><option value="name">Name A–Z</option></select></label>
          </section>

          <div className="patient-results-meta"><p>{loading ? 'Finding doctors...' : `${filtered.length} ${filtered.length === 1 ? 'doctor' : 'doctors'} found`}</p>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>

          {error ? <ErrorState message={error} onRetry={loadDoctors} /> : loading ? <LoadingGrid count={8} /> : filtered.length === 0 ? (
            <EmptyState title="No matching doctors" message="Try adjusting your search or filters to discover more care options." actionLabel="Explore services" actionTo="/services" />
          ) : (
            <section className="doctor-directory-grid" aria-label="Doctors">
              {filtered.map((doctor) => <DoctorCard key={getId(doctor)} doctor={doctor} />)}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function DoctorCard({ doctor }) {
  const available = isAvailable(doctor)
  const schedule = cleanSchedule(doctor.schedule)
  const slotCount = schedule.reduce((total, day) => total + day.slots.length, 0)
  const initials = String(doctor.name || 'Doctor').split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <article className="doctor-directory-card">
      <div className="doctor-directory-card__image">
        <ImageWithFallback src={doctor.imageUrl} alt={doctor.name || 'Doctor'} initials={initials} />
        <span className={available ? 'availability-pill availability-pill--available' : 'availability-pill'}><i />{available ? 'Available' : 'Unavailable'}</span>
      </div>
      <div className="doctor-directory-card__body">
        <p className="doctor-directory-card__specialty"><Stethoscope size={14} /> {doctor.specialization || 'General medicine'}</p>
        <h2>{doctor.name || 'MediCare doctor'}</h2>
        <p className="doctor-directory-card__location"><MapPin size={14} /> {doctor.location || 'Location available on request'}</p>
        <div className="doctor-directory-card__metrics">
          <span><Star size={14} fill="currentColor" /> {Number(doctor.rating || 0).toFixed(1)}<small>Rating</small></span>
          <span><CalendarDays size={14} /> {slotCount}<small>Open slots</small></span>
          <span>{formatCurrency(doctor.fee)}<small>Consultation</small></span>
        </div>
        <Link to={`/doctors/${getId(doctor)}`}>{available ? 'View & book' : 'View profile'} <ArrowRight size={16} /></Link>
      </div>
    </article>
  )
}
