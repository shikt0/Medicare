import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import Hero from './pages/Hero'

const adminPages = [
  { path: '/add', title: 'Add Doctor' },
  { path: '/list', title: 'List Doctors' },
  { path: '/appointments', title: 'Appointments' },
  { path: '/service-dashboard', title: 'Service Dashboard' },
  { path: '/add-service', title: 'Add Service' },
  { path: '/list-service', title: 'List Services' },
  { path: '/service-appointments', title: 'Service Appointments' },
]

const App = () => {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Hero/>}/>
        {adminPages.map((page) => (
          <Route
            key={page.path}
            path={page.path}
            element={<AdminPage title={page.title} />}
          />
        ))}
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
