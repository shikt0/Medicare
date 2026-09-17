import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import BasicPage from './pages/BasicPage'
import Doctors from './pages/Doctors'
import DoctorDetails from './pages/DoctorDetails'
import Services from './pages/Services'
import ServiceDetails from './pages/ServiceDetails'
import Appointments from './pages/Appointments'
import Contact from './pages/Contact'
import DoctorLogin from './pages/DoctorLogin'
import PaymentResult from './pages/PaymentResult'
import DoctorPortal from './pages/DoctorPortal'
import LabResults from './pages/LabResults'
import LoginPortal from './pages/LoginPortal'
import PatientLogin from './pages/PatientLogin'

const App = () => {
  return (
    <div>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='/doctors' element={<Doctors/>}/>
        <Route path='/doctors/:id' element={<DoctorDetails/>}/>
        <Route path='/services' element={<Services/>}/>
        <Route path='/services/:id' element={<ServiceDetails/>}/>
        <Route path='/appointments' element={<Appointments/>}/>
        <Route path='/lab-results' element={<LabResults/>}/>
        <Route path='/contact' element={<Contact/>}/>
        <Route path='/login' element={<LoginPortal/>}/>
        <Route path='/patient-login/*' element={<PatientLogin/>}/>
        <Route path='/patient-sign-up/*' element={<PatientLogin mode="sign-up"/>}/>
        <Route path='/doctor/login' element={<DoctorLogin/>}/>
        <Route path='/doctor-admin/login' element={<DoctorLogin/>}/>
        <Route path='/doctor-portal/*' element={<DoctorPortal/>}/>
        <Route path='/appointment/success' element={<PaymentResult kind="doctor" outcome="success"/>}/>
        <Route path='/appointment/cancel' element={<PaymentResult kind="doctor" outcome="cancel"/>}/>
        <Route path='/service-appointment/success' element={<PaymentResult kind="service" outcome="success"/>}/>
        <Route path='/service-appointment/cancel' element={<PaymentResult kind="service" outcome="cancel"/>}/>
        <Route path='*' element={<BasicPage title="Page Not Found"/>}/>

      </Routes>
    </div>
  )
}

export default App
