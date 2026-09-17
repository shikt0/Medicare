import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { getRoleDashboard } from '../controllers/dashboardController.js'

const router = express.Router()
router.get('/', authenticateActor, requireRole('admin', 'nurse', 'pathologist', 'hr', 'freelancer'), getRoleDashboard)
export default router
