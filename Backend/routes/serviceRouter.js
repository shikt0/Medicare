import express from 'express';
import multer from 'multer';
import { tmpdir } from 'node:os';


import { createService, deleteService,getServiceById,getServices,updateService } from '../controllers/serviceController.js';
import { authenticateActor, requireRole } from '../middlewares/auth.js';

const upload= multer({dest:tmpdir()});
const serviceRouter =express.Router();

serviceRouter.get("/",getServices);
serviceRouter.get("/:id",getServiceById);

serviceRouter.post("/",authenticateActor,requireRole('admin'),upload.single("image"), createService);
serviceRouter.put("/:id",authenticateActor,requireRole('admin'),upload.single("image"),updateService);

serviceRouter.delete("/:id",authenticateActor,requireRole('admin'),deleteService);

export default serviceRouter;
