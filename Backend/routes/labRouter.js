import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { assignPathologist, createLabTest, getLabTest, listLabTests, submitLabResult, updateLabStatus } from '../controllers/labController.js'

const router = express.Router()
router.use(authenticateActor)
router.get('/', requireRole('admin', 'doctor', 'pathologist', 'patient'), listLabTests)
router.post('/', requireRole('admin', 'doctor'), createLabTest)
router.get('/:id', requireRole('admin', 'doctor', 'pathologist', 'patient'), getLabTest)
router.patch('/:id/assign', requireRole('admin'), assignPathologist)
router.patch('/:id/status', requireRole('admin', 'pathologist'), updateLabStatus)
router.put('/:id/result', requireRole('pathologist'), submitLabResult)
export default router
