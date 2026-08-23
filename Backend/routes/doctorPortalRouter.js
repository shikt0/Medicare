import express from 'express'
import doctorAuth from '../middlewares/doctorAuth.js'
import { getDoctorPortalAppointments, getDoctorPortalMe, updateDoctorPortalAppointment } from '../controllers/doctorPortalController.js'

const doctorPortalRouter = express.Router()

doctorPortalRouter.use(doctorAuth)
doctorPortalRouter.get('/me', getDoctorPortalMe)
doctorPortalRouter.get('/appointments', getDoctorPortalAppointments)
doctorPortalRouter.patch('/appointments/:id', updateDoctorPortalAppointment)

export default doctorPortalRouter

