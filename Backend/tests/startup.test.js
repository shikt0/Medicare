import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { startServer, startupErrorMessage } from '../utils/startServer.js'

test('missing or invalid database configuration fails before any connection attempt', async (t) => {
  const connect = t.mock.method(mongoose, 'connect', () => { throw new Error('must not connect') })
  for (const uri of ['', '   ']) {
    await assert.rejects(connectDB(uri), { code: 'MONGODB_URI_MISSING' })
  }
  for (const uri of ['https://example.com', 'mongodb://', 'mongodb://host with spaces']) {
    await assert.rejects(connectDB(uri), { code: 'MONGODB_URI_INVALID' })
  }
  assert.equal(connect.mock.callCount(), 0)
})

test('connection uses the configured URI and propagates failure without a local fallback', async (t) => {
  const previous = process.env.MONGODB_URI
  t.after(() => {
    if (previous === undefined) delete process.env.MONGODB_URI
    else process.env.MONGODB_URI = previous
  })
  const uri = 'mongodb+srv://example.invalid/medicare'
  process.env.MONGODB_URI = uri
  const failure = Object.assign(new Error('connection rejected'), { code: 'ENOTFOUND' })
  const connect = t.mock.method(mongoose, 'connect', async () => { throw failure })
  await assert.rejects(connectDB(), (error) => error === failure)
  assert.equal(connect.mock.callCount(), 1)
  assert.deepEqual(connect.mock.calls[0].arguments, [uri])
})

test('API listener and success logs wait for a successful database connection', async () => {
  const events = []
  const server = new EventEmitter()
  let resolveConnection
  const ready = new Promise((resolve) => { resolveConnection = resolve })
  const startup = startServer({
    listen(port) {
      events.push(`listen:${port}`)
      queueMicrotask(() => server.emit('listening'))
      return server
    },
  }, {
    port: 4000,
    connect: async () => {
      events.push('connecting')
      await ready
      events.push('connected')
    },
    disconnect: async () => events.push('disconnect'),
    log: (message) => events.push(message),
  })
  await Promise.resolve()
  assert.deepEqual(events, ['connecting'])
  resolveConnection()
  assert.equal(await startup, server)
  assert.deepEqual(events, [
    'connecting', 'connected', 'listen:4000', 'DB CONNECTED',
    'Server started on http://localhost:4000',
  ])
})

test('failed connection never listens or reports success and closes partial DB handles', async () => {
  const events = []
  await assert.rejects(startServer({ listen() { events.push('listen') } }, {
    connect: async () => { throw Object.assign(new Error('mongodb://private-user:private-password@private-host'), { code: 'ENOTFOUND' }) },
    disconnect: async () => {
      events.push('disconnect')
      throw new Error('cleanup contains private-password')
    },
    log: (message) => events.push(message),
  }), (error) => {
    assert.equal(error.code, 'STARTUP_FAILED')
    assert.match(error.message, /hostname could not be resolved/)
    assert.doesNotMatch(error.stack, /private-user|private-password|private-host|mongodb:\/\//)
    assert.equal(error.cause, undefined)
    return true
  })
  assert.deepEqual(events, ['disconnect'])
})

test('listen failure closes the database connection without reporting startup success', async () => {
  const server = new EventEmitter()
  const events = []
  await assert.rejects(startServer({
    listen() {
      queueMicrotask(() => server.emit('error', Object.assign(new Error('in use'), { code: 'EADDRINUSE' })))
      return server
    },
  }, {
    connect: async () => events.push('connected'),
    disconnect: async () => events.push('disconnect'),
    log: (message) => events.push(message),
  }), /API port is already in use/)
  assert.deepEqual(events, ['connected', 'disconnect'])
})

test('wrapped DNS, authentication, and network failures produce actionable messages without error data', () => {
  const secret = 'mongodb+srv://private-user:private-password@private-host/medicare'
  const cases = [
    [{ cause: { code: 'ENOTFOUND', message: secret } }, /hostname could not be resolved/],
    [{ reason: { servers: new Map([['hidden-host', { error: { code: 18, message: secret } }]]) } }, /authentication was rejected/],
    [{ name: 'MongoServerSelectionError', message: secret }, /network access list/],
    [{ name: 'MongoParseError', message: secret }, /URL-encode/],
    [{ code: 'MONGODB_URI_MISSING', message: secret }, /set MONGODB_URI/],
    [{ message: secret }, /could not start/],
  ]
  for (const [failure, expected] of cases) {
    const message = startupErrorMessage(failure)
    assert.match(message, expected)
    assert.doesNotMatch(message, /private-user|private-password|private-host|hidden-host|mongodb\+srv:/)
  }
})

test('actual server exits nonzero without listening when its configured URI is invalid', () => {
  const result = spawnSync(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, MONGODB_URI: 'invalid-private-credential-sentinel' },
    encoding: 'utf8',
    timeout: 10000,
    windowsHide: true,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 1)
  const output = `${result.stdout}\n${result.stderr}`
  assert.match(output, /MONGODB_URI is invalid/)
  assert.doesNotMatch(output, /Server started|DB CONNECTED|invalid-private-credential-sentinel/)
})
