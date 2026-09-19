import express from 'express';
import { getServiceAppointment, confirmServicePayment,getServiceAppointmentStats, CreateServiceAppointment, getServiceAppointmentByPatient, getServiceAppointmentById, updateServiceAppointment, cancelServiceAppointment } from '../controllers/serviceAppointmentController.js';
import { authenticateActor, requireRole } from '../middlewares/auth.js';

const serviceAppointmentRouter=express.Router();

serviceAppointmentRouter.get("/",authenticateActor,requireRole('admin','pathologist'),getServiceAppointment);
serviceAppointmentRouter.get("/confirm", confirmServicePayment);
serviceAppointmentRouter.get("/stats/summary",authenticateActor,requireRole('admin','pathologist'),getServiceAppointmentStats);


serviceAppointmentRouter.post("/",authenticateActor,requireRole('patient'),CreateServiceAppointment);

serviceAppointmentRouter.get("/me",authenticateActor,requireRole('patient'),getServiceAppointmentByPatient);

serviceAppointmentRouter.get("/:id",authenticateActor,requireRole('admin','pathologist'),getServiceAppointmentById);
serviceAppointmentRouter.put("/:id",authenticateActor,requireRole('admin','pathologist'),updateServiceAppointment);
serviceAppointmentRouter.post("/:id/cancel",authenticateActor,requireRole('patient','admin'),cancelServiceAppointment);

export default serviceAppointmentRouter;
