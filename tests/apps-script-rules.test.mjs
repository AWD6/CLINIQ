import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = await readFile(resolve(root, 'apps-script/Code.gs'), 'utf8')

function createHarness() {
  let nextId = 0
  const names = {
    clinics: 'Clinics', physicians: 'Physicians', user_profiles: 'Users',
    schedule_templates: 'ScheduleTemplates', schedule_sessions: 'Sessions',
    notifications: 'Notifications', activity_events: 'ActivityEvents',
  }
  const tables = {
    Clinics: [{ _row: 2, id: 'c1', is_active: true }],
    Physicians: [
      { _row: 2, id: 'p1', is_active: true, is_placeholder: false },
      { _row: 3, id: 'p2', is_active: true, is_placeholder: true },
      { _row: 4, id: 'p3', is_active: false, is_placeholder: false },
    ],
    Users: [], ScheduleTemplates: [], Sessions: [], Notifications: [], ActivityEvents: [],
  }
  const events = []
  const formatDate = (value, _timezone, format) => {
    const date = new Date(value)
    if (format === 'yyyy-MM-dd') return date.toISOString().slice(0, 10)
    if (format === 'HH:mm:ss') return date.toISOString().slice(11, 19)
    throw new Error(`Unsupported mock format: ${format}`)
  }
  const context = vm.createContext({
    Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-sheet' }) },
    Utilities: {
      Charset: { UTF_8: 'UTF-8' },
      getUuid: () => `test-${++nextId}`,
      formatDate,
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  })
  vm.runInContext(source, context, { filename: 'Code.gs' })
  context.records_ = (name) => tables[names[name] || name] || []
  context.appendRecord_ = (name, row) => {
    const table = tables[names[name] || name]
    if (!table) throw new Error(`Missing mock table ${name}`)
    table.push({ ...row, _row: table.length + 2 })
  }
  context.writeFields_ = (name, rowNumber, fields) => {
    const table = tables[names[name] || name]
    const row = table?.find((item) => item._row === rowNumber)
    if (!row) throw new Error(`Missing mock row ${name}:${rowNumber}`)
    Object.assign(row, fields)
  }
  context.logEvent_ = (...event) => events.push(event)
  context.bangkokToday_ = () => '2026-10-20'
  return { context, tables, events }
}

test('generates repeat-safe sessions only for active, confirmed physicians', () => {
  const { context, tables } = createHarness()
  tables.ScheduleTemplates.push(
    { _row: 2, id: 't1', clinic_id: 'c1', physician_id: 'p1', weekday: 1, week_of_month: 0, start_time: '16:00', end_time: '20:00', appointment_quota: 20, effective_from: '2026-10-01', is_active: true },
    { _row: 3, id: 't2', clinic_id: 'c1', physician_id: 'p2', weekday: 1, week_of_month: 0, start_time: '16:00', end_time: '20:00', appointment_quota: 20, effective_from: '2026-10-01', is_active: true },
    { _row: 4, id: 't3', clinic_id: 'c1', physician_id: 'p3', weekday: 1, week_of_month: 0, start_time: '16:00', end_time: '20:00', appointment_quota: 20, effective_from: '2026-10-01', is_active: true },
  )

  assert.equal(context.generateSessions_({ id: 'admin', role: 'admin' }, '2026-10-26', '2026-11-02'), 2)
  assert.deepEqual(tables.Sessions.map((row) => row.physician_id), ['p1', 'p1'])
  assert.equal(context.generateSessions_({ id: 'admin', role: 'admin' }, '2026-10-26', '2026-11-02'), 0)
  assert.equal(tables.Sessions.length, 2)
})

test('creates one in-app reminder at 7, 3, and 1 days and skips placeholders', () => {
  const { context, tables } = createHarness()
  tables.Users.push(
    { _row: 2, id: 'u1', role: 'physician', physician_id: 'p1', is_active: true },
    { _row: 3, id: 'u2', role: 'physician', physician_id: 'p2', is_active: true },
  )
  for (const [id, date] of [['s1', '2026-10-21'], ['s3', '2026-10-23'], ['s7', '2026-10-27']]) {
    tables.Sessions.push({ _row: tables.Sessions.length + 2, id, physician_id: 'p1', session_date: date, session_status: 'scheduled' })
  }
  tables.Sessions.push({ _row: 5, id: 'placeholder-session', physician_id: 'p2', session_date: '2026-10-21', session_status: 'scheduled' })

  context.generateDueNotifications_({ role: 'admin' })
  context.generateDueNotifications_({ role: 'admin' })

  assert.equal(tables.Notifications.length, 3)
  assert.deepEqual([...new Set(tables.Notifications.map((row) => row.kind))].sort(), ['reminder_1', 'reminder_3', 'reminder_7'])
  assert.ok(tables.Notifications.every((row) => row.user_id === 'u1' && row.read_at === null))
})

test('doctor confirmation and busy response preserve the scheduled session', () => {
  const { context, tables } = createHarness()
  tables.Sessions.push(
    { _row: 2, id: 's-busy', physician_id: 'p1', session_status: 'scheduled', doctor_response_status: 'pending' },
    { _row: 3, id: 's-confirm', physician_id: 'p1', session_status: 'scheduled', doctor_response_status: 'pending' },
  )
  const physician = { id: 'u1', role: 'physician', physician_id: 'p1', display_name: 'Test physician' }

  assert.throws(() => context.respondToSession_(physician, 's-busy', 'busy', ''), /กรุณาระบุหมายเหตุ/)
  context.respondToSession_(physician, 's-busy', 'busy', 'หมายเหตุทดสอบ')
  context.respondToSession_(physician, 's-confirm', 'confirmed', null)

  assert.equal(tables.Sessions[0].doctor_response_status, 'busy')
  assert.equal(tables.Sessions[0].doctor_response_note, 'หมายเหตุทดสอบ')
  assert.equal(tables.Sessions[0].session_status, 'scheduled')
  assert.equal(tables.Sessions[1].doctor_response_status, 'confirmed')
  assert.equal(tables.Sessions[1].session_status, 'scheduled')
  assert.equal(tables.Sessions[0].resolved_at, undefined)
  assert.equal(tables.Sessions[1].doctor_responded_at != null, true)
})

test('keeps physician reads scoped and rejects admin-only changes', () => {
  const { context, tables } = createHarness()
  tables.Sessions.push(
    { _row: 2, id: 'own-session', physician_id: 'p1', replaces_physician_id: null },
    { _row: 3, id: 'replacement-session', physician_id: 'p3', replaces_physician_id: 'p1' },
    { _row: 4, id: 'other-session', physician_id: 'p2', replaces_physician_id: null },
  )
  const physician = { id: 'u1', role: 'physician', physician_id: 'p1' }

  assert.deepEqual(context.readableRows_(physician, 'schedule_sessions').map((row) => row.id), ['own-session', 'replacement-session'])
  assert.throws(() => context.rpc_(physician, { name: 'generate_schedule_sessions', args: {} }), /สิทธิ์พยาบาล/)
  assert.throws(() => context.insert_(physician, 'clinics', { name: 'Test', short_name: 'T' }), /สิทธิ์พยาบาล/)
  assert.throws(() => context.update_(physician, 'schedule_sessions', { appointment_count: 10 }, [{ op: 'eq', column: 'id', value: 'other-session' }]), /สิทธิ์พยาบาล/)
  assert.equal(context.canChangeRow_(physician, 'notifications', { user_id: 'u1', physician_id: 'p1' }), true)
  assert.equal(context.canChangeRow_(physician, 'notifications', { user_id: 'u2', physician_id: 'p2' }), false)
  assert.equal(tables.Sessions[2].id, 'other-session')
})
