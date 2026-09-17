import test from 'node:test'
import assert from 'node:assert/strict'
import { isLocalAdminRequest, requireRole, sanitizeStaff } from '../middlewares/auth.js'

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.payload = payload; return this },
  }
}

test('requireRole rejects unauthenticated requests', () => {
  const res = responseRecorder()
  let continued = false
  requireRole('admin')({}, res, () => { continued = true })
  assert.equal(res.statusCode, 401)
  assert.equal(continued, false)
})

test('requireRole rejects a different authenticated role', () => {
  const res = responseRecorder()
  let continued = false
  requireRole('admin')({ actor: { role: 'nurse' } }, res, () => { continued = true })
  assert.equal(res.statusCode, 403)
  assert.equal(continued, false)
})

test('requireRole permits an allowed role', () => {
  const res = responseRecorder()
  let continued = false
  requireRole('admin', 'hr')({ actor: { role: 'admin' } }, res, () => { continued = true })
  assert.equal(res.statusCode, 200)
  assert.equal(continued, true)
})

test('requireRole blocks inactive staff even when the role matches', () => {
  const res = responseRecorder()
  let continued = false
  requireRole('nurse')({ actor: { role: 'nurse', staff: { status: 'inactive' } } }, res, () => { continued = true })
  assert.equal(res.statusCode, 403)
  assert.equal(continued, false)
})

test('local admin bypass only accepts the dedicated development origin', () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  assert.equal(isLocalAdminRequest({ get: () => 'http://localhost:5174' }), true)
  assert.equal(isLocalAdminRequest({ get: () => 'http://127.0.0.1:5174/' }), true)
  assert.equal(isLocalAdminRequest({ get: () => 'http://localhost:5173' }), false)
  assert.equal(isLocalAdminRequest({ get: () => 'https://medicare.example.com' }), false)
  process.env.NODE_ENV = 'production'
  assert.equal(isLocalAdminRequest({ get: () => 'http://localhost:5174' }), false)
  if (previous === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = previous
})

test('staff serialization never exposes password hashes', () => {
  const result = sanitizeStaff({
    _id: 'staff-1',
    name: 'Test Nurse',
    role: 'nurse',
    password: '$2b$12$private-hash',
    passwordSetAt: new Date(),
  })
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'password'), false)
  assert.equal(result.loginEnabled, true)
  assert.equal(result.accountLinked, true)
})
