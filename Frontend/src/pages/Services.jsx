import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Microscope, Search, SlidersHorizontal, WalletCards, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { EmptyState, ErrorState, ImageWithFallback, LoadingGrid, PageIntro } from '../components/PatientUi'
import { patientApi } from '../lib/api'
import { formatCurrency, getId } from '../lib/format'

export default function Services() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
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
      return matchesQuery
    })
    return [...result].sort((first, second) => {
      if (sort === 'price-low') return Number(first.price || 0) - Number(second.price || 0)
      if (sort === 'price-high') return Number(second.price || 0) - Number(first.price || 0)
      if (sort === 'name') return String(first.name || '').localeCompare(String(second.name || ''))
      return 0
    })
  }, [query, services, sort])

  const hasFilters = query || sort !== 'recommended'

  function clearFilters() {
    setQuery('')
    setSort('recommended')
  }

  return (
    <div className="patient-site">
      <Navbar />
      <main className="patient-page">
        <div className="patient-page__inner">
          <PageIntro kicker="Care services" title="Explore medical services" description="Find diagnostic, preventive, and clinical services with clear pricing and 24/7 request availability." />
          <section className="patient-filter-panel patient-filter-panel--services" aria-label="Service filters">
            <label className="patient-search-field"><Search size={18} /><span className="sr-only">Search services</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tests, scans, or services" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
            <div className="patient-filter-pills"><button type="button" className="is-active" disabled>All services · Open 24/7</button></div>
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
  return (
    <article className="service-directory-card">
      <div className="service-directory-card__image">
        <ImageWithFallback src={service.imageUrl} alt={service.name || 'Medical service'} initials="MC" />
        <span className="availability-pill availability-pill--available"><i />Open 24/7</span>
        <span className="service-directory-card__price">{formatCurrency(service.price)}</span>
      </div>
      <div className="service-directory-card__body">
        <p><Microscope size={14} /> MediCare service</p>
        <h2>{service.name || 'Medical service'}</h2>
        <span>{service.shortDescription || service.about || 'Professional care with clear preparation and booking details.'}</span>
        <div className="service-directory-card__details"><small><CalendarDays size={14} /> Open 24/7</small><small><WalletCards size={14} /> Clear pricing</small></div>
        {Array.isArray(service.instructions) && service.instructions.length > 0 && <div className="service-directory-card__instruction"><Check size={13} /> Preparation guidance included</div>}
        <Link to={`/services/${getId(service)}`}>View & request <ArrowRight size={16} /></Link>
      </div>
    </article>
  )
}
