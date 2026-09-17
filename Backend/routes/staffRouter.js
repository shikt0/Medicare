import express from 'express'
import {
  createStaff,
  deactivateStaff,
  getMyStaffProfile,
  getStaffById,
  getStaffStats,
  listStaff,
  staffLogin,
  updateMyStaffProfile,
  updateStaff,
  updateStaffStatus,
} from '../controllers/staffController.js'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import upload from '../middlewares/multer.js'

const staffRouter = express.Router()
const staffRoles = ['nurse', 'pathologist', 'hr', 'freelancer']

staffRouter.post('/login', staffLogin)
staffRouter.use(authenticateActor)

staffRouter.get('/me', requireRole(...staffRoles), getMyStaffProfile)
staffRouter.patch('/me', requireRole(...staffRoles), profileImageUpload, updateMyStaffProfile)

staffRouter.get('/stats', requireRole('admin', 'hr'), getStaffStats)
staffRouter.get('/', requireRole('admin', 'hr'), listStaff)
staffRouter.post('/', requireRole('admin'), createStaff)
staffRouter.get('/:id', requireRole('admin', 'hr'), getStaffById)
staffRouter.put('/:id', requireRole('admin'), updateStaff)
staffRouter.patch('/:id/status', requireRole('admin'), updateStaffStatus)
staffRouter.delete('/:id', requireRole('admin'), deactivateStaff)

export default staffRouter

function profileImageUpload(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (!error) return next()
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Profile image must be 5 MB or smaller'
      : error.message || 'Unable to upload profile image'
    return res.status(400).json({ success: false, message })
  })
}
