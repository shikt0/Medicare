import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { createAnnouncement, deleteAnnouncement, getMyAnnouncements, listAnnouncements, markAnnouncementRead, updateAnnouncement } from '../controllers/announcementController.js'

const router = express.Router()
router.use(authenticateActor)
router.get('/my', requireRole('nurse', 'pathologist', 'hr', 'freelancer'), getMyAnnouncements)
router.patch('/:id/read', requireRole('nurse', 'pathologist', 'hr', 'freelancer'), markAnnouncementRead)
router.get('/', requireRole('admin', 'hr'), listAnnouncements)
router.post('/', requireRole('admin', 'hr'), createAnnouncement)
router.put('/:id', requireRole('admin', 'hr'), updateAnnouncement)
router.delete('/:id', requireRole('admin', 'hr'), deleteAnnouncement)
export default router
