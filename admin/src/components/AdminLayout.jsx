import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <a href="#workspace-content" className="skip-link">Skip to content</a>
      <Navbar />
      <div id="workspace-content" tabIndex={-1} className="admin-workspace">
        <div className="admin-ambient" aria-hidden="true" />
        <Outlet />
      </div>
    </div>
  )
}
