import express from 'express'
import { cancelAppointment, confirmPayment, createAppointment, getAppointment, getAppointmentByDoctor, getAppointmentByPatient, getRegisteredUserCount, getStats, updateAppointment } from '../controllers/appointmentController.js'
import { authenticateActor, requireRole } from '../middlewares/auth.js'


const appointmentRouter =express.Router();

appointmentRouter.get("/",authenticateActor,requireRole('admin'),getAppointment);
appointmentRouter.get("/confirm",confirmPayment);
appointmentRouter.get("/stats/summary",authenticateActor,requireRole('admin'),getStats);


//authentic routes

appointmentRouter.post("/",authenticateActor,requireRole('patient'),createAppointment);
appointmentRouter.get("/me",authenticateActor,requireRole('patient'),getAppointmentByPatient);


appointmentRouter.get("/doctor/:doctorId",authenticateActor,requireRole('doctor','admin'),getAppointmentByDoctor);

appointmentRouter.post("/:id/cancel",authenticateActor,requireRole('patient','admin'),cancelAppointment);
appointmentRouter.get("/patients/count",authenticateActor,requireRole('admin'),getRegisteredUserCount);
appointmentRouter.put("/:id",authenticateActor,requireRole('admin'),updateAppointment);

export default appointmentRouter;
