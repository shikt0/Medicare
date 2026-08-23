import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Microscope, Search, SlidersHorizontal, WalletCards, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { EmptyState, ErrorState, ImageWithFallback, LoadingGrid, PageIntro } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { cleanSchedule, formatCurrency, getId, isAvailable } from '../lib/format'

export default function Services() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('recommended')

  const loadServices = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setServices(await patientApi.getServices())
    } catch (loadError) {
      setError(loadError.message || 'Unable to load services.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(loadServices, 0)
    return () => window.clearTimeout(timeout)
  }, [loadServices])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const result = services.filter((service) => {
      const matchesQuery = !keyword || [service.name, service.shortDescription, service.about]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword))
      const matchesFilter = filter === 'All' || (filter === 'Available' ? isAvailable(service) : !isAvailable(service))
      return matchesQuery && matchesFilter
    })
    return [...result].sort((first, second) => {
      if (sort === 'price-low') return Number(first.price || 0) - Number(second.price || 0)
      if (sort === 'price-high') return Number(second.price || 0) - Number(first.price || 0)
      if (sort === 'name') return String(first.name || '').localeCompare(String(second.name || ''))
      return Number(isAvailable(second)) - Number(isAvailable(first))
    })
  }, [filter, query, services, sort])

  const hasFilters = query || filter !== 'All' || sort !== 'recommended'

  function clearFilters() {
    setQuery('')
    setFilter('All')
    setSort('recommended')
  }

  return (
    <div className="patient-site">
      <Navbar />
      <main className="patient-page">
        <div className="patient-page__inner">
          <PageIntro kicker="Care services" title="Explore medical services" description="Find diagnostic, preventive, and clinical services with clear pricing, preparation guidance, and available times." />
          <section className="patient-filter-panel patient-filter-panel--services" aria-label="Service filters">
            <label className="patient-search-field"><Search size={18} /><span className="sr-only">Search services</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tests, scans, or services" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
            <div className="patient-filter-pills">{['All', 'Available', 'Unavailable'].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? 'is-active' : ''}>{value}</button>)}</div>
            <label className="patient-sort-field"><SlidersHorizontal size={15} /><span className="sr-only">Sort services</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name A–Z</option></select></label>
          </section>
          <div className="patient-results-meta"><p>{loading ? 'Finding services...' : `${filtered.length} ${filtered.length === 1 ? 'service' : 'services'} found`}</p>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>

          {error ? <ErrorState message={error} onRetry={loadServices} /> : loading ? <LoadingGrid count={6} /> : filtered.length === 0 ? (
            <EmptyState title="No matching services" message="Try a broader search or clear the current filters." actionLabel="Browse doctors" actionTo="/doctors" />
          ) : (
            <section className="service-directory-grid" aria-label="Medical services">
              {filtered.map((service) => <ServiceCard key={getId(service)} service={service} />)}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function ServiceCard({ service }) {
  const available = isAvailable(service)
  const schedule = cleanSchedule(service.slots)
  const slotCount = schedule.reduce((total, day) => total + day.slots.length, 0)
  return (
    <article className="service-directory-card">
      <div className="service-directory-card__image">
        <ImageWithFallback src={service.imageUrl} alt={service.name || 'Medical service'} initials="MC" />
        <span className={available ? 'availability-pill availability-pill--available' : 'availability-pill'}><i />{available ? 'Available' : 'Unavailable'}</span>
        <span className="service-directory-card__price">{formatCurrency(service.price)}</span>
      </div>
      <div className="service-directory-card__body">
        <p><Microscope size={14} /> MediCare service</p>
        <h2>{service.name || 'Medical service'}</h2>
        <span>{service.shortDescription || service.about || 'Professional care with clear preparation and booking details.'}</span>
        <div className="service-directory-card__details"><small><CalendarDays size={14} /> {slotCount} upcoming slots</small><small><WalletCards size={14} /> Clear pricing</small></div>
        {Array.isArray(service.instructions) && service.instructions.length > 0 && <div className="service-directory-card__instruction"><Check size={13} /> Preparation guidance included</div>}
        <Link to={`/services/${getId(service)}`}>{available ? 'View & book' : 'View service'} <ArrowRight size={16} /></Link>
      </div>
    </article>
  )
}
