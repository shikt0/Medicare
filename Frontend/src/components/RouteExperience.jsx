import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const titles = {
  '/': 'Your health, in good hands',
  '/doctors': 'Find your doctor',
  '/services': 'Medical services',
  '/appointments': 'Your appointments',
  '/lab-results': 'Your lab results',
  '/contact': 'Contact our care team',
  '/login': 'Login portals',
  '/patient-login': 'Patient login',
  '/patient-sign-up': 'Create your patient account',
  '/doctor/login': 'Doctor login',
  '/doctor-admin/login': 'Doctor login',
}

export default function RouteExperience() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    const title = titles[pathname] || (pathname.startsWith('/doctor-portal') ? 'Doctor portal'
      : pathname.startsWith('/doctors/') ? 'Doctor profile'
        : pathname.startsWith('/services/') ? 'Service details'
          : pathname.includes('appointment/') ? 'Payment status' : 'MediCare')
    document.title = title === 'MediCare' ? title : `${title} | MediCare`
    if (navigationType !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' })
    const main = document.querySelector('main')
    if (main) {
      main.id = 'main-content'
      main.tabIndex = -1
    }
  }, [pathname, navigationType])

  return null
}
