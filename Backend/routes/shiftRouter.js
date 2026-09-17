import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { cancelShift, createShift, getMyShifts, getShiftById, listShifts, updateShift } from '../controllers/shiftController.js'

const router = express.Router()
router.use(authenticateActor)
router.get('/my', requireRole('nurse', 'pathologist', 'hr', 'freelancer'), getMyShifts)
router.get('/', requireRole('admin', 'hr'), listShifts)
router.post('/', requireRole('admin', 'hr'), createShift)
router.get('/:id', requireRole('admin', 'hr', 'nurse', 'pathologist', 'freelancer'), getShiftById)
router.put('/:id', requireRole('admin', 'hr'), updateShift)
router.delete('/:id', requireRole('admin', 'hr'), cancelShift)
export default router
