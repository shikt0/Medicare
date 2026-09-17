import express from 'express'
import { claimStaffAccount, getCurrentActor } from '../controllers/authController.js'
import { authenticateActor } from '../middlewares/auth.js'

const authRouter = express.Router()

authRouter.get('/me', authenticateActor, getCurrentActor)
authRouter.post('/claim-staff', authenticateActor, claimStaffAccount)

export default authRouter
