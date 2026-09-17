import { authenticateActor, requireRole } from './auth.js'

const requireDoctor = requireRole('doctor')

export default function doctorAuth(req, res, next) {
  return authenticateActor(req, res, () => requireDoctor(req, res, next))
}
