import express from 'express';
import multer from 'multer';
import { tmpdir } from 'node:os';
import {createDoctor, deleteDoctor, doctorLogin, getDoctorById, getDoctors, toggleAvailability, updateDoctor} from '../controllers/doctorController.js';

import doctorAuth from '../middlewares/doctorAuth.js';
import { authenticateActor, requireRole } from '../middlewares/auth.js';

const upload= multer({dest: tmpdir()});

const doctorRouter= express.Router();


doctorRouter.get("/",getDoctors);
doctorRouter.post("/login", doctorLogin);
doctorRouter.get("/admin",authenticateActor,requireRole('admin'),(req,res) => {
    req.adminView = true;
    return getDoctors(req,res);
});
doctorRouter.get("/:id",getDoctorById);
doctorRouter.post("/",authenticateActor,requireRole('admin'),upload.single("image"),createDoctor);

//after login
doctorRouter.put("/:id",authenticateActor,requireRole('doctor','admin'),upload.single("image"),updateDoctor);
doctorRouter.post("/:id/toggle-availability",doctorAuth,toggleAvailability);
doctorRouter.delete("/:id",authenticateActor,requireRole('admin'),deleteDoctor);

export default doctorRouter;
