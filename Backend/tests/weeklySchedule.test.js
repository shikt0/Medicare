import test from 'node:test'
import assert from 'node:assert/strict'
import { isWeeklySlotAvailable, normalizeWeeklySchedule, weekdayKeyForDate } from '../utils/weeklySchedule.js'

test('weekly schedules normalize weekday names, times, and duplicates', () => {
  const schedule = normalizeWeeklySchedule({
    Monday: ['2:00 pm', '09:30 AM', '02:00 PM'],
    wed: ['11:00 AM'],
  })

  assert.deepEqual(schedule, {
    monday: ['09:30 AM', '02:00 PM'],
    wednesday: ['11:00 AM'],
  })
})

test('legacy date schedules migrate to their recurring weekday', () => {
  assert.equal(weekdayKeyForDate('2026-09-21'), 'monday')
  assert.deepEqual(normalizeWeeklySchedule({ '2026-09-21': ['10:00 AM'] }), {
    monday: ['10:00 AM'],
  })
})

test('a weekly slot is available on future matching weekdays only', () => {
  const schedule = { monday: ['09:00 AM'] }
  assert.equal(isWeeklySlotAvailable(schedule, '2026-09-21', '9:00 am'), true)
  assert.equal(isWeeklySlotAvailable(schedule, '2026-09-22', '09:00 AM'), false)
  assert.equal(isWeeklySlotAvailable(schedule, '2026-09-21', '10:00 AM'), false)
})

test('invalid calendar dates and times are rejected', () => {
  assert.equal(weekdayKeyForDate('2026-02-30'), '')
  assert.equal(isWeeklySlotAvailable({ monday: ['09:00 AM'] }, 'not-a-date', '09:00 AM'), false)
  assert.deepEqual(normalizeWeeklySchedule({ monday: ['25:00 PM', '09:75 AM'] }), { monday: [] })
})
