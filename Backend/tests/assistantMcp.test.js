import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import express from 'express'
import cors from 'cors'
import { createAssistantMcpRouter } from '../assistant/mcp.js'
import { createApiCorsOptions } from '../assistant/cors.js'
import { AssistantToolError, listAssistantTools } from '../assistant/tools.js'

const doctors = { first: '507f191e810c19729de860ea', second: '507f191e810c19729de860eb' }
async function appFixture(t, { runTool = async ({ actor }) => ({ scopedTo: actor.id }), actorOverride, ...options } = {}) {
  const app = express()
  app.use(cors(createApiCorsOptions(['http://localhost:5173'], ['https://assistant.example'])))
  app.use(express.json({ limit: '40kb' }))
  // Test-only auth fixture: production authentication is supplied by the parent router.
  app.use((req, res, next) => {
    req.actor = actorOverride || (req.get('x-test-account') === 'patient'
      ? { role: 'patient', id: 'user_patient_one', authType: 'clerk' }
      : { role: 'doctor', id: req.get('x-test-account') === 'second' ? doctors.second : doctors.first, authType: 'jwt' })
    next()
  })
  app.use('/api/assistant/mcp', createAssistantMcpRouter({ allowedHosts: ['localhost:4000'], allowedOrigins: ['http://localhost:5173', 'https://assistant.example'], runTool, ...options }))
  app.use((error, req, res, next) => res.status(403).json({ error: 'Origin rejected' }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve) }))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return async (body, { method = 'POST', headers = {}, path = '/api/assistant/mcp' } = {}) => {
    const payload = method === 'POST' ? JSON.stringify(body) : ''
    return new Promise((resolve, reject) => {
      const request = httpRequest(`${baseUrl}${path}`, { method, headers: { host: 'localhost:4000', accept: 'application/json, text/event-stream', 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'mcp-protocol-version': '2025-11-25', ...headers } }, (response) => {
        let text = ''
        response.on('data', (chunk) => { text += chunk })
        response.on('end', () => { try { resolve({ status: response.statusCode, headers: new Headers(response.headers), body: text ? JSON.parse(text) : null }) } catch (error) { reject(error) } })
      })
      request.once('error', reject)
      request.setTimeout(5000, () => request.destroy(new Error('MCP test request timed out')))
      request.end(payload)
    })
  }
}

test('real SDK transport initializes statelessly and returns read-only role-specific MCP tools', async (t) => {
  const request = await appFixture(t)
  const initialized = await request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
  assert.equal(initialized.status, 200)
  assert.equal(initialized.body.result.serverInfo.name, 'medicare-assistant')
  assert.equal(initialized.headers.get('mcp-session-id'), null)
  const listed = await request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  assert.equal(listed.status, 200)
  assert.ok(listed.body.result.tools.some((tool) => tool.name === 'my_schedule'))
  assert.ok(!listed.body.result.tools.some((tool) => tool.name === 'my_appointments'))
  assert.ok(listed.body.result.tools.every((tool) => tool.annotations.readOnlyHint === true && tool.annotations.destructiveHint === false))
  assert.equal(listed.headers.get('cache-control'), 'no-store')
  const patient = await request({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }, { headers: { 'x-test-account': 'patient' } })
  assert.ok(patient.body.result.tools.some((tool) => tool.name === 'my_appointments'))
  assert.ok(!patient.body.result.tools.some((tool) => tool.name === 'get_patient_context'))
})

test('independent MCP requests bind each verified doctor and never share actor context', async (t) => {
  const request = await appFixture(t)
  const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'my_schedule', arguments: {} } }
  const [first, second] = await Promise.all([request(body), request(body, { headers: { 'x-test-account': 'second' } })])
  assert.equal(first.body.result.structuredContent.scopedTo, doctors.first)
  assert.equal(second.body.result.structuredContent.scopedTo, doctors.second)
})

test('MCP rejects unexpected hosts, origins, admin bypass, batches, and non-POST methods', async (t) => {
  const request = await appFixture(t)
  const body = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
  assert.equal((await request(body, { headers: { host: 'evil.example' } })).status, 403)
  assert.equal((await request(body, { headers: { origin: 'https://evil.example' } })).status, 403)
  assert.equal((await request([body])).status, 400)
  const get = await request(undefined, { method: 'GET' })
  assert.equal(get.status, 405)
  assert.equal(get.headers.get('allow'), 'POST')
  const adminRequest = await appFixture(t, { actorOverride: { role: 'admin', id: 'local-development-admin', authType: 'local-development' } })
  assert.equal((await adminRequest(body)).status, 403)
})

test('MCP surfaces controlled tool errors and removes unexpected database exception details', async (t) => {
  const request = await appFixture(t, { runTool: async ({ name }) => {
    if (name === 'my_schedule') throw new AssistantToolError('Appointment not found.', 'NOT_FOUND', 404)
    throw new Error('mongodb://secret-password patient private-note')
  } })
  const safe = await request({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'my_schedule' } })
  assert.equal(safe.body.result.isError, true)
  assert.equal(safe.body.result.structuredContent.error.code, 'NOT_FOUND')
  const unknown = await request({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_patient_context' } })
  assert.equal(unknown.body.result.isError, true)
  assert.equal(unknown.body.result.structuredContent.error.code, 'TOOL_UNAVAILABLE')
  assert.equal(JSON.stringify(unknown).includes('private-note'), false)
  assert.equal(JSON.stringify(unknown).includes('secret-password'), false)
})

test('MCP actor validation runs before initialize or tool enumeration', async (t) => {
  let calls = 0
  const request = await appFixture(t, { actorOverride: { role: 'doctor', id: 'invalid', authType: 'jwt' }, listTools(actor) { calls++; return listAssistantTools(actor) } })
  const result = await request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
  assert.equal(result.status, 401)
  assert.equal(calls, 1)
})

test('MCP browser preflight allows protocol headers and configured MCP origin without widening other APIs', async (t) => {
  const request = await appFixture(t)
  const headers = { origin: 'https://assistant.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type,mcp-protocol-version,mcp-session-id' }
  const preflight = await request(undefined, { method: 'OPTIONS', headers })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://assistant.example')
  assert.match(preflight.headers.get('access-control-allow-headers'), /MCP-Protocol-Version/)
  assert.match(preflight.headers.get('access-control-allow-headers'), /MCP-Session-Id/)
  assert.match(preflight.headers.get('access-control-expose-headers'), /MCP-Session-Id/)
  const other = await request(undefined, { method: 'OPTIONS', headers, path: '/api/doctors' })
  assert.equal(other.status, 403)
  const existing = await request(undefined, { method: 'OPTIONS', headers: { ...headers, origin: 'http://localhost:5173' }, path: '/api/doctors' })
  assert.equal(existing.status, 204)
  assert.equal(existing.headers.get('access-control-allow-headers'), 'Content-Type,Authorization')
})
