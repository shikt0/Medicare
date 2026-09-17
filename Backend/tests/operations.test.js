import test from 'node:test'
import assert from 'node:assert/strict'
import Announcement from '../models/Announcement.js'
import Applicant from '../models/Applicant.js'
import FreelancerAssignment from '../models/FreelancerAssignment.js'
import JobOpening from '../models/JobOpening.js'
import LabTestOrder from '../models/LabTestOrder.js'
import Shift from '../models/Shift.js'
import { PATHOLOGIST_TRANSITIONS } from '../controllers/labController.js'
import { OWNER_TRANSITIONS } from '../controllers/freelancerController.js'
import { isDateKey, isTime24, timeMinutes } from '../utils/validation.js'

const objectId = '507f1f77bcf86cd799439011'

test('schedule validation accepts real date keys and 24-hour times', () => {
  assert.equal(isDateKey('2026-09-15'), true)
  assert.equal(isDateKey('2026-02-30'), false)
  assert.equal(isTime24('23:59'), true)
  assert.equal(isTime24('9:30 AM'), false)
  assert.equal(timeMinutes('08:30'), 510)
})

test('Shift requires a supported role and valid core scheduling fields', async () => {
  const shift = new Shift({ staffId: objectId, role: 'nurse', date: '2026-09-15', startTime: '08:00', endTime: '16:00', assignedBy: 'admin-1' })
  await assert.doesNotReject(() => shift.validate())
  shift.role = 'doctor'
  await assert.rejects(() => shift.validate(), /not a valid enum value/)
})

test('Lab orders default to an ordered normal-priority workflow', async () => {
  const order = new LabTestOrder({ patientId: 'patient-1', patientName: 'Patient', doctorId: objectId, doctorName: 'Doctor', testName: 'CBC', sampleType: 'Blood', createdBy: 'doctor-1' })
  await order.validate()
  assert.equal(order.status, 'ordered')
  assert.equal(order.priority, 'normal')
  assert.deepEqual(PATHOLOGIST_TRANSITIONS.ordered, ['sample-collected'])
  assert.deepEqual(PATHOLOGIST_TRANSITIONS.completed, [])
})

test('Recruitment models enforce job and applicant workflow enums', async () => {
  const job = new JobOpening({ title: 'Nurse', department: 'Ward', role: 'nurse', employmentType: 'full-time', description: 'Care role', deadline: new Date('2027-01-01'), createdBy: 'hr-1' })
  await assert.doesNotReject(() => job.validate())
  const applicant = new Applicant({ jobId: objectId, name: 'Applicant', email: 'person@example.com', phone: '123', cvUrl: 'https://example.com/cv' })
  await assert.doesNotReject(() => applicant.validate())
  applicant.status = 'interviewed'
  await assert.rejects(() => applicant.validate(), /not a valid enum value/)
})

test('Announcements support role targeting and priority controls', async () => {
  const item = new Announcement({ title: 'Ward notice', message: 'Please review.', createdBy: 'hr-1', targetType: 'role', targetRole: 'nurse', priority: 'important' })
  await assert.doesNotReject(() => item.validate())
  item.targetRole = 'doctor'
  await assert.rejects(() => item.validate(), /not a valid enum value/)
})

test('Freelancer assignments follow a one-way owner lifecycle', async () => {
  const item = new FreelancerAssignment({ freelancerId: objectId, title: 'Audit', description: 'Review records', department: 'Operations', assignedBy: 'hr-1', date: '2026-09-20', startTime: '09:00', endTime: '12:00' })
  await item.validate()
  assert.equal(item.status, 'assigned')
  assert.deepEqual(OWNER_TRANSITIONS.assigned, ['accepted'])
  assert.deepEqual(OWNER_TRANSITIONS.completed, [])
})
