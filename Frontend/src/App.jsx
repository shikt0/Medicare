import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import BasicPage from './pages/BasicPage'

const App = () => {
  return (
    <div>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route path='/doctors' element={<BasicPage title="Doctors"/>}/>
        <Route path='/services' element={<BasicPage title="Services"/>}/>
        <Route path='/appointments' element={<BasicPage title="Appointments"/>}/>
        <Route path='/contact' element={<BasicPage title="Contact"/>}/>
        <Route path='/doctor-admin/login' element={<BasicPage title="Doctor Admin Login"/>}/>
        <Route path='*' element={<BasicPage title="Page Not Found"/>}/>

      </Routes>
    </div>
  )
}

export default App
