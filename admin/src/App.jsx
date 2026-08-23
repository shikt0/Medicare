import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './pages/Hero'
import AddDoctor from './pages/AddDoctor'
import DoctorsList from './pages/DoctorsList'
import Appointments from './pages/Appointments'
import ServiceDashboard from './pages/ServiceDashboard'
import AddService from './pages/AddService'
import ServicesList from './pages/ServicesList'
import ServiceAppointments from './pages/ServiceAppointments'

const App = () => {
  return (
    <div className="admin-shell">
      <Navbar />
      <div className="admin-workspace">
        <div className="admin-ambient" aria-hidden="true" />
        <Routes>
          <Route path="/" element={<Hero/>}/>
          <Route path="/add" element={<AddDoctor />} />
          <Route path="/list" element={<DoctorsList />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/service-dashboard" element={<ServiceDashboard />} />
          <Route path="/add-service" element={<AddService />} />
          <Route path="/list-service" element={<ServicesList />} />
          <Route path="/service-appointments" element={<ServiceAppointments />} />
          <Route path="*" element={<AdminPage title="Page Not Found" />} />
        </Routes>
      </div>
    </div>
  );
};

export default App

function AdminPage({ title }) {
  return (
    <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="page-heading">
          <div>
            <p className="page-eyebrow">Medicare admin</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm">The page you requested could not be found.</p>
          </div>
        </header>
      </div>
    </main>
  )
}
