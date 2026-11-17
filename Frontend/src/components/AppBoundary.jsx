import { Component } from 'react'

export function AppNotice({ title = 'Something went wrong', children }) {
  return (
    <main className="app-notice">
      <a href="/" className="app-notice__brand">MediCare<span>Health, thoughtfully delivered</span></a>
      <div className="app-notice__panel">
        <p>Let’s get you back on track</p>
        <h1>{title}</h1>
        <div>{children}</div>
        <button type="button" className="premium-button premium-button--primary" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </main>
  )
}

export default class AppBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('MediCare could not render this page:', error)
  }

  render() {
    if (this.state.failed) {
      return <AppNotice>We couldn’t open this page. Please reload to try again, or return to the <a href="/">MediCare home page</a>.</AppNotice>
    }
    return this.props.children
  }
}
