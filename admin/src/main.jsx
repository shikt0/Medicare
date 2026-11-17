
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const application = <BrowserRouter><App /></BrowserRouter>

createRoot(document.getElementById('root')).render(
  publishableKey ? <ClerkProvider publishableKey={publishableKey}>{application}</ClerkProvider> : application,
);
