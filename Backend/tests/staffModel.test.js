import test from 'node:test'
import assert from 'node:assert/strict'
import Staff from '../models/Staff.js'

function validStaff(overrides = {}) {
  return new Staff({
    employeeId: 'NUR-001',
    name: 'Test Nurse',
    email: 'nurse@example.com',
    role: 'nurse',
    employmentType: 'full-time',
    status: 'active',
    ...overrides,
  })
}

test('Staff accepts the four supported workforce roles', async () => {
  for (const role of ['nurse', 'pathologist', 'hr', 'freelancer']) {
    await assert.doesNotReject(() => validStaff({ role }).validate())
  }
})

test('Staff rejects unsupported roles', async () => {
  await assert.rejects(() => validStaff({ role: 'admin' }).validate(), /not a valid enum value/)
})

test('Staff requires its core identity fields', async () => {
  const staff = new Staff({ role: 'nurse' })
  await assert.rejects(() => staff.validate(), /required/)
})

test('Staff defaults to active full-time employment without a linked account', async () => {
  const staff = validStaff()
  await staff.validate()
  assert.equal(staff.status, 'active')
  assert.equal(staff.employmentType, 'full-time')
  assert.equal(staff.authUserId, undefined)
})

test('Staff passwords are excluded from queries by default', () => {
  assert.equal(Staff.schema.path('password').options.select, false)
})
