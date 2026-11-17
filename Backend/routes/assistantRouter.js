import express from 'express'
import { authenticateActor, requireRole } from '../middlewares/auth.js'
import { assistantChat } from '../assistant/chat.js'
import { assistantStatus } from '../assistant/ollama.js'
import { createAssistantMcpRouter } from '../assistant/mcp.js'

const router = express.Router()
const buckets = new Map()

export function assistantRateLimit(req, res, next) {
  const now = Date.now()
  for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key)
  const key = req.actor?.id ? `${req.actor.role}:${req.actor.id}` : `guest:${req.socket.remoteAddress}`
  const bucket = buckets.get(key) || { count: 0, reset: now + 600000 }
  if (bucket.count >= 60 || (!buckets.has(key) && buckets.size >= 2000)) {
    res.set('Retry-After', '60')
    return res.status(429).json({ success: false, message: 'Please wait a minute before asking more questions.' })
  }
  bucket.count += 1
  buckets.set(key, bucket)
  return next()
}

function optionalActor(req, res, next) {
  if (req.get('authorization')) return authenticateActor(req, res, next)
  req.actor = { role: 'guest', id: null, name: '' }
  return next()
}

router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
router.get('/status', assistantRateLimit, async (_req, res) => {
  res.json({ success: true, data: await assistantStatus() })
})
router.use('/mcp', authenticateActor, requireRole('patient', 'doctor'), assistantRateLimit, createAssistantMcpRouter())
router.post('/chat', optionalActor, (req, res, next) => {
  if (!['guest', 'patient', 'doctor'].includes(req.actor?.role) || req.actor.authType === 'local-development') {
    return res.status(403).json({ success: false, message: 'Sign in as a patient or doctor to use this assistant.' })
  }
  next()
}, assistantRateLimit, async (req, res) => {
  const controller = new AbortController()
  const onClose = () => { if (!res.writableEnded) controller.abort() }
  res.on('close', onClose)
  try {
    const data = await assistantChat({ actor: req.actor, body: req.body, signal: controller.signal })
    if (!res.destroyed) res.json({ success: true, data })
  } catch (error) {
    if (!res.destroyed) res.status([400, 401, 403, 404, 409, 429, 499, 503, 504].includes(error.status) ? error.status : 503)
      .json({ success: false, code: error.code || 'ASSISTANT_UNAVAILABLE', message: error.status ? error.message : 'The assistant could not read the requested information. Please try again.' })
  } finally { res.off('close', onClose) }
})

export default router
