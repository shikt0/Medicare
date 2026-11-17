import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'

export function startupErrorMessage(error) {
  // Driver failures may wrap the useful code in a cause or topology description.
  // Inspect them for classification only; never interpolate errors or connection strings.
  const pending = [error]
  const seen = new Set()
  const failures = []
  while (pending.length) {
    const failure = pending.pop()
    if (!failure || typeof failure !== 'object' || seen.has(failure)) continue
    seen.add(failure)
    failures.push(failure)
    pending.push(failure.cause, failure.reason, failure.error)
    if (failure.servers instanceof Map) pending.push(...failure.servers.values())
  }
  const hasCode = (...codes) => failures.some((failure) => codes.includes(failure.code))
  const hasName = (...names) => failures.some((failure) => names.includes(failure.name))
  const hasMessage = (pattern) => failures.some((failure) => pattern.test(String(failure.message || '')))

  if (hasCode('MONGODB_URI_MISSING')) {
    return 'Startup failed: set MONGODB_URI in Backend/.env to your online database connection string.'
  }
  if (hasCode('MONGODB_URI_INVALID') || hasName('MongoParseError')) {
    return 'Startup failed: MONGODB_URI is invalid. Copy the database connection string again and URL-encode any special characters in its credentials.'
  }
  if (hasCode('ENOTFOUND', 'ENODATA', 'EAI_AGAIN', 'ESERVFAIL') || hasMessage(/querySrv|queryTxt/i)) {
    return 'Startup failed: the MongoDB hostname could not be resolved. Check that the online cluster exists and is running, verify MONGODB_URI, and check DNS access.'
  }
  if (hasCode(18, 8000) || hasMessage(/authentication failed|bad auth|auth failed|AuthenticationFailed|SCRAM/i)) {
    return 'Startup failed: MongoDB authentication was rejected. Check the database username, password, and authSource in MONGODB_URI.'
  }
  if (hasCode('EADDRINUSE')) {
    return 'Startup failed: the API port is already in use. Stop the existing API process before starting another one.'
  }
  if (hasCode('ECONNREFUSED', 'ETIMEDOUT', 'ETIMEOUT', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH')
      || hasName('MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError')) {
    return 'Startup failed: MongoDB could not be reached. Check your internet connection, the cluster status, its network access list, and firewall settings.'
  }
  return 'Startup failed: the API could not start. Check the database connection configuration and network access.'
}

export async function startServer(app, {
  port = 4000,
  connect = connectDB,
  disconnect = () => mongoose.disconnect(),
  log = (message) => console.log(message),
} = {}) {
  let server
  try {
    await connect()
    await new Promise((resolve, reject) => {
      server = app.listen(port)
      const onError = (error) => {
        server.removeListener('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        server.removeListener('error', onError)
        resolve()
      }
      server.once('error', onError)
      server.once('listening', onListening)
    })
  } catch (error) {
    // Also clean up a partially opened connection after DNS, auth, or listen failure.
    try { await disconnect() } catch { /* Keep the original, sanitized startup failure. */ }
    throw Object.assign(new Error(startupErrorMessage(error)), { code: 'STARTUP_FAILED' })
  }
  log('DB CONNECTED')
  log(`Server started on http://localhost:${port}`)
  return server
}
