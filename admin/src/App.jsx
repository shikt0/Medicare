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
    <>
      <Navbar />
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
    </>
  );
};

export default App

function AdminPage({ title }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 font-serif">
      <h1 className="text-3xl font-bold text-emerald-700">{title}</h1>
    </main>
  )
}
