import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { applyForJob, createJob, getPublicJob, listManagedJobs, listPublicJobs, updateJob, updateJobStatus } from '../controllers/recruitmentController.js'

const router = express.Router()
router.get('/', listPublicJobs)
router.get('/manage', authenticateActor, requireRole('admin', 'hr'), listManagedJobs)
router.post('/', authenticateActor, requireRole('admin', 'hr'), createJob)
router.put('/:id', authenticateActor, requireRole('admin', 'hr'), updateJob)
router.patch('/:id/status', authenticateActor, requireRole('admin', 'hr'), updateJobStatus)
router.post('/:id/apply', applyForJob)
router.get('/:id', getPublicJob)
export default router
