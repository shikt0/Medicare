import express from 'express';
import { clerkMiddleware,requireAuth } from '@clerk/express';

import { getServiceAppointment, confirmServicePayment,getServiceAppointmentStats, CreateServiceAppointment, getServiceAppointmentByPatient, getServiceAppointmentById, updateServiceAppointment, cancelServiceAppointment } from '../controllers/serviceAppointmentController.js';

const serviceAppointmentRouter=express.Router();

serviceAppointmentRouter.get("/",getServiceAppointment);
serviceAppointmentRouter.get("/confirm", confirmServicePayment);
serviceAppointmentRouter.get("/stats/summary",getServiceAppointmentStats);


serviceAppointmentRouter.post("/",clerkMiddleware(),requireAuth(),CreateServiceAppointment);

serviceAppointmentRouter.get("/me",clerkMiddleware(),requireAuth(), getServiceAppointmentByPatient);

serviceAppointmentRouter.get("/:id",getServiceAppointmentById);
serviceAppointmentRouter.put("/:id",updateServiceAppointment);
serviceAppointmentRouter.post("/:id/cancel", cancelServiceAppointment);

export default serviceAppointmentRouter;