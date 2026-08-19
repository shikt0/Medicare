import express from 'express'
import { clerkMiddleware,requireAuth } from '@clerk/express'
import { cancelAppointment, confirmPayment, createAppointment, getAppointment, getAppointmentByDoctor, getAppointmentByPatient, getRegisteredUserCount, getStats, updateAppointment } from '../controllers/appointmentController.js'


const appointmentRouter =express.Router();

appointmentRouter.get("/",getAppointment);
appointmentRouter.get("/confirm",confirmPayment);
appointmentRouter.get("/stats/summary",getStats);


//authentic routes

appointmentRouter.post("/",clerkMiddleware(),requireAuth(), createAppointment);
appointmentRouter.get("/me", clerkMiddleware(),requireAuth(),getAppointmentByPatient);


appointmentRouter.get("/doctor/:doctorId",getAppointmentByDoctor);

appointmentRouter.post("/:id/cancel",cancelAppointment);
appointmentRouter.get("/patients/count",getRegisteredUserCount);
appointmentRouter.put("/:id",updateAppointment);

export default appointmentRouter;