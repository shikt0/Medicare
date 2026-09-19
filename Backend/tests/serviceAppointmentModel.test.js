import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import ServiceAppointment from '../models/serviceAppointment.js'
import AssignmentCursor from '../models/AssignmentCursor.js'
import { roundRobinItem } from '../utils/roundRobin.js'

function validRequest(overrides = {}) {
  return new ServiceAppointment({
    createdBy: 'patient_123',
    patientName: 'Test Patient',
    mobile: '01700000000',
    serviceId: new mongoose.Types.ObjectId(),
    serviceName: 'Blood test',
    fees: 500,
    payment: { method: 'Cash', status: 'Pending', amount: 500 },
    ...overrides,
  })
}

test('service requests do not require a date or time', async () => {
  const request = validRequest()
  await assert.doesNotReject(() => request.validate())
  assert.equal(request.date, '')
  assert.equal(request.hour, null)
  assert.equal(request.minute, null)
  assert.equal(request.ampm, '')
  assert.ok(request.requestedAt instanceof Date)
})

test('service requests retain their automatic pathologist assignment snapshot', async () => {
  const pathologistId = new mongoose.Types.ObjectId()
  const request = validRequest({
    assignedPathologist: pathologistId,
    assignedPathologistName: 'Dr. Pathology',
    assignedPathologistEmployeeId: 'PAT-001',
    assignedAt: new Date(),
    assignmentSequence: 4,
  })
  await request.validate()
  assert.equal(String(request.assignedPathologist), String(pathologistId))
  assert.equal(request.assignedPathologistEmployeeId, 'PAT-001')
  assert.equal(request.assignmentSequence, 4)
})

test('assignment cursor stores the serial round-robin position', async () => {
  const cursor = new AssignmentCursor({ _id: 'service-pathologist', sequence: 7 })
  await assert.doesNotReject(() => cursor.validate())
  assert.equal(cursor.sequence, 7)
})

test('pathologists are selected serially and then repeat from the start', () => {
  const pathologists = ['PAT-001', 'PAT-002', 'PAT-003']
  assert.equal(roundRobinItem(pathologists, 1), 'PAT-001')
  assert.equal(roundRobinItem(pathologists, 2), 'PAT-002')
  assert.equal(roundRobinItem(pathologists, 3), 'PAT-003')
  assert.equal(roundRobinItem(pathologists, 4), 'PAT-001')
})
