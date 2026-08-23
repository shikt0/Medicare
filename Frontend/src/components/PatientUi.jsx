import { AlertCircle, ArrowRight, LoaderCircle, RefreshCw, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

export function PageIntro({ kicker, title, description, actions, compact = false }) {
  return (
    <header className={`patient-page-intro ${compact ? 'patient-page-intro--compact' : ''}`}>
      <div><p>{kicker}</p><h1>{title}</h1><span>{description}</span></div>
      {actions && <div className="patient-page-intro__actions">{actions}</div>}
    </header>
  )
}

export function LoadingGrid({ count = 6 }) {
  return <div className="patient-loading-grid" aria-busy="true" aria-label="Loading"><span className="sr-only">Loading</span>{Array.from({ length: count }, (_, index) => <div key={index} className="patient-loading-card"><div /><span /><span /><i /></div>)}</div>
}

export function LoadingPanel({ label = 'Loading your care information...' }) {
  return <div className="patient-loading-panel"><LoaderCircle size={22} className="animate-spin" /><p>{label}</p></div>
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="patient-error-state" role="alert">
      <span><AlertCircle size={22} /></span>
      <div><h2>We could not load this right now</h2><p>{message}</p></div>
      {onRetry && <button type="button" onClick={onRetry}><RefreshCw size={15} /> Try again</button>}
    </div>
  )
}

export function EmptyState({ title, message, actionLabel, actionTo }) {
  return (
    <div className="patient-empty-state">
      <span><SearchX size={25} /></span><h2>{title}</h2><p>{message}</p>
      {actionLabel && actionTo && <Link to={actionTo}>{actionLabel} <ArrowRight size={15} /></Link>}
    </div>
  )
}

export function ImageWithFallback({ src, alt = '', initials = 'MC', className = '' }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <span className={`patient-image-fallback ${className}`}>{initials}</span>
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}
