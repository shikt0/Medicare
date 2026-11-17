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

test('local admin bypass requires explicit opt-in and a loopback connection', () => {
  const previous = process.env.NODE_ENV
  const previousFlag = process.env.ENABLE_LOCAL_ADMIN
  const request = (origin, address = '127.0.0.1') => ({ get: () => origin, socket: { remoteAddress: address } })
  try {
    process.env.NODE_ENV = 'development'
    delete process.env.ENABLE_LOCAL_ADMIN
    assert.equal(isLocalAdminRequest(request('http://localhost:5174')), false)
    process.env.ENABLE_LOCAL_ADMIN = 'true'
    assert.equal(isLocalAdminRequest(request('http://localhost:5174')), true)
    assert.equal(isLocalAdminRequest(request('http://127.0.0.1:5174/', '::1')), true)
    assert.equal(isLocalAdminRequest(request('http://localhost:5174', '203.0.113.10')), false)
    assert.equal(isLocalAdminRequest(request('http://localhost:5173')), false)
    assert.equal(isLocalAdminRequest(request('https://medicare.example.com')), false)
    process.env.NODE_ENV = 'production'
    assert.equal(isLocalAdminRequest(request('http://localhost:5174')), false)
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previous
    if (previousFlag === undefined) delete process.env.ENABLE_LOCAL_ADMIN
    else process.env.ENABLE_LOCAL_ADMIN = previousFlag
  }
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

test('Clerk-linked staff are reported as linked without a local password', () => {
  const result = sanitizeStaff({ _id: 'staff-1', authUserId: 'user-1' })
  assert.equal(result.accountLinked, true)
  assert.equal(result.loginEnabled, false)
  assert.equal(Object.hasOwn(result, 'authUserId'), false)
})
