import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <Navbar />
      <div className="admin-workspace">
        <div className="admin-ambient" aria-hidden="true" />
        <Outlet />
      </div>
    </div>
  )
}
