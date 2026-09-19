import React, { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import AddDoctor from './pages/AddDoctor'
import DoctorsList from './pages/DoctorsList'
import Appointments from './pages/Appointments'
import ServiceDashboard from './pages/ServiceDashboard'
import AddService from './pages/AddService'
import ServicesList from './pages/ServicesList'
import ServiceAppointments from './pages/ServiceAppointments'
import { StaffAuthProvider } from './auth/StaffAuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import WorkforceAuth from './pages/WorkforceAuth'
import Unauthorized from './pages/Unauthorized'
import StaffManagement from './pages/StaffManagement'
import PortalHome from './pages/PortalHome'
import MySchedule from './pages/MySchedule'
import MyAnnouncements from './pages/MyAnnouncements'
import MyProfile from './pages/MyProfile'
import DutyManagement from './pages/DutyManagement'
import Laboratory from './pages/Laboratory'
import Recruitment from './pages/Recruitment'
import AnnouncementManagement from './pages/AnnouncementManagement'
import FreelancerAssignments from './pages/FreelancerAssignments'
import StaffLoginLanding from './pages/StaffLoginLanding'
import { useStaffAuth } from './auth/staffAuth'

const App = () => {
  return (
    <StaffAuthProvider>
      <PortalDocumentTitle />
      <Routes>
        <Route path="/login" element={<StaffLoginLanding />} />
        <Route path="/nurse/login/*" element={<WorkforceAuth expectedRole="nurse" />} />
        <Route path="/pathologist/login/*" element={<WorkforceAuth expectedRole="pathologist" />} />
        <Route path="/hr/login/*" element={<WorkforceAuth expectedRole="hr" />} />
        <Route path="/freelancer/login/*" element={<WorkforceAuth expectedRole="freelancer" />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<PortalHome />} />
            <Route path="/add" element={<AddDoctor />} />
            <Route path="/list" element={<DoctorsList />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/service-dashboard" element={<ServiceDashboard />} />
            <Route path="/add-service" element={<AddService />} />
            <Route path="/list-service" element={<ServicesList />} />
            <Route path="/service-appointments" element={<ServiceAppointments />} />
            <Route path="/staff-management" element={<StaffManagement />} />
            <Route path="/duty-management" element={<DutyManagement />} />
            <Route path="/recruitment" element={<Recruitment />} />
            <Route path="/announcements" element={<AnnouncementManagement />} />
            <Route path="/laboratory" element={<Laboratory />} />
            <Route path="/freelancer-assignments" element={<FreelancerAssignments />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['nurse']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/nurse-portal" element={<PortalHome />} />
            <Route path="/nurse-portal/schedule" element={<MySchedule />} />
            <Route path="/nurse-portal/announcements" element={<MyAnnouncements />} />
            <Route path="/nurse-portal/profile" element={<MyProfile />} />
            <Route path="/nurse-portal/*" element={<PortalPage title="Nurse Page Not Found" />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['pathologist']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/pathologist-portal" element={<PortalHome />} />
            <Route path="/pathologist-portal/service-requests" element={<ServiceAppointments />} />
            <Route path="/pathologist-portal/laboratory" element={<Laboratory />} />
            <Route path="/pathologist-portal/announcements" element={<MyAnnouncements />} />
            <Route path="/pathologist-portal/profile" element={<MyProfile />} />
            <Route path="/pathologist-portal/*" element={<PortalPage title="Pathologist Page Not Found" />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['hr']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/hr-portal" element={<PortalHome />} />
            <Route path="/hr-portal/staff" element={<StaffManagement />} />
            <Route path="/hr-portal/duties" element={<DutyManagement />} />
            <Route path="/hr-portal/recruitment" element={<Recruitment />} />
            <Route path="/hr-portal/announcements" element={<AnnouncementManagement />} />
            <Route path="/hr-portal/freelancers" element={<FreelancerAssignments />} />
            <Route path="/hr-portal/profile" element={<MyProfile />} />
            <Route path="/hr-portal/*" element={<PortalPage title="HR Page Not Found" />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['freelancer']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/freelancer-portal" element={<PortalHome />} />
            <Route path="/freelancer-portal/assignments" element={<FreelancerAssignments />} />
            <Route path="/freelancer-portal/announcements" element={<MyAnnouncements />} />
            <Route path="/freelancer-portal/profile" element={<MyProfile />} />
            <Route path="/freelancer-portal/*" element={<PortalPage title="Freelancer Page Not Found" />} />
          </Route>
        </Route>
        <Route path="*" element={<PortalPage title="Page Not Found" />} />
      </Routes>
    </StaffAuthProvider>
  );
};

export default App

const roleTitles = {
  nurse: 'MediCare Nurse Portal',
  pathologist: 'MediCare Pathologist Portal',
  hr: 'MediCare HR Portal',
  freelancer: 'MediCare Freelancer Portal',
  admin: 'MediCare Admin',
}

function PortalDocumentTitle() {
  const location = useLocation()
  const { actor, localAdminBypass } = useStaffAuth()
  const pathRole = ['nurse', 'pathologist', 'hr', 'freelancer'].find((role) => (
    location.pathname.startsWith(`/${role}/`) || location.pathname.startsWith(`/${role}-portal`)
  ))

  useEffect(() => {
    if (pathRole) document.title = roleTitles[pathRole]
    else if (location.pathname === '/login') document.title = 'MediCare Login Portals'
    else if (location.pathname === '/unauthorized') document.title = 'MediCare Access Restricted'
    else if (localAdminBypass || actor?.role === 'admin') document.title = roleTitles.admin
    else document.title = 'MediCare Staff Portal'
  }, [actor?.role, localAdminBypass, location.pathname, pathRole])

  return null
}

function PortalPage({ title }) {
  return (
    <main className="admin-page min-h-screen px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="page-heading">
          <div>
            <p className="page-eyebrow">MediCare portal</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm">The page you requested could not be found.</p>
          </div>
        </header>
      </div>
    </main>
  )
}
