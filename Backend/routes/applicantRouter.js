import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { listApplicants, updateApplicantStatus } from '../controllers/recruitmentController.js'

const router = express.Router()
router.use(authenticateActor, requireRole('admin', 'hr'))
router.get('/', listApplicants)
router.patch('/:id/status', updateApplicantStatus)
export default router
