import 'dotenv/config'
import mongoose from 'mongoose'
import { auditAppointmentSlotIndex, migrateAppointmentSlotIndex } from '../utils/appointmentSlots.js'

let connection
try {
  const args = process.argv.slice(2)
  if (args.some((arg) => !['--check', '--show-conflicts'].includes(arg))) throw new Error('Unsupported migration argument')
  const checkOnly = args.includes('--check')
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
  connection = await mongoose.createConnection(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false }).asPromise()
  const collection = connection.db.collection('appointments')
  const result = await (checkOnly ? auditAppointmentSlotIndex(collection) : migrateAppointmentSlotIndex(collection))
  console.log(JSON.stringify({ indexInstalled: result.indexInstalled, conflictingSlotCount: result.conflictingRecordIds.length, invalidRecordCount: result.invalidRecordIds.length }))
  if (args.includes('--show-conflicts') && (result.conflictingRecordIds.length || result.invalidRecordIds.length)) {
    console.error(JSON.stringify({ conflictingRecordIds: result.conflictingRecordIds, invalidRecordIds: result.invalidRecordIds }, null, 2))
  }
  if (checkOnly) {
    console.log('Read-only check complete. No indexes or appointment records were changed.')
    if (!result.indexInstalled || result.conflictingRecordIds.length || result.invalidRecordIds.length) process.exitCode = 1
  } else if (!result.applied) {
    console.error('Migration refused. No records were modified. Run with --check --show-conflicts to inspect record IDs.')
    process.exitCode = 1
  } else {
    console.log('The unique active appointment-slot index is installed. No appointment records were modified.')
  }
} catch (error) {
  // Avoid printing database URIs, patient fields, or MongoDB duplicate-key values.
  console.error('Appointment-slot migration failed. No appointment records were modified.', { code: error.code || error.name || 'MIGRATION_FAILED' })
  process.exitCode = 1
} finally {
  if (connection) await connection.close()
}
