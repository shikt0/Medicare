import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { createAssignment, getAssignment, getMyAssignments, listAssignments, updateAssignment, updateAssignmentStatus } from '../controllers/freelancerController.js'

const router = express.Router()
router.use(authenticateActor)
router.get('/my', requireRole('freelancer'), getMyAssignments)
router.get('/', requireRole('admin', 'hr'), listAssignments)
router.post('/', requireRole('admin', 'hr'), createAssignment)
router.get('/:id', requireRole('admin', 'hr', 'freelancer'), getAssignment)
router.put('/:id', requireRole('admin', 'hr'), updateAssignment)
router.patch('/:id/status', requireRole('admin', 'hr', 'freelancer'), updateAssignmentStatus)
export default router
