export class AssistantError extends Error {
  constructor(message, status = 503, code = 'ASSISTANT_UNAVAILABLE') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function assistantConfig(env = process.env) {
  const url = new URL(env.ASSISTANT_OLLAMA_URL || 'http://127.0.0.1:11434')
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new AssistantError('Configure Ollama on a loopback HTTP address.', 503, 'LOCAL_MODEL_REQUIRED')
  }
  const model = env.ASSISTANT_MODEL || 'qwen2.5:1.5b'
  if (!/^[a-zA-Z0-9._:/-]{1,100}$/.test(model) || /cloud/i.test(model)) {
    throw new AssistantError('Choose an installed local Ollama model.', 503, 'LOCAL_MODEL_REQUIRED')
  }
  return { url: url.origin, model, enabled: env.ASSISTANT_ENABLED !== 'false' }
}

export async function assistantStatus({ fetchImpl = fetch, env = process.env } = {}) {
  let config
  try { config = assistantConfig(env) } catch { return { available: false, provider: 'ollama', local: true, message: 'Local model configuration needs attention.' } }
  if (!config.enabled) return { available: false, provider: 'ollama', model: config.model, local: true, message: 'The local assistant is disabled.' }
  try {
    const response = await fetchImpl(`${config.url}/api/tags`, { signal: AbortSignal.timeout(3500), redirect: 'error' })
    if (!response.ok) throw new Error('unavailable')
    const data = await response.json()
    const installed = data.models?.find((model) => (model.name === config.model || model.model === config.model) && !model.remote_host && !model.remote_model)
    return { available: Boolean(installed), provider: 'ollama', model: config.model, local: true,
      message: installed ? 'Local assistant ready.' : 'The configured model is not installed in Ollama.' }
  } catch { return { available: false, provider: 'ollama', model: config.model, local: true, message: 'Ollama is offline. Start Ollama on the backend computer.' } }
}

let generating = false

// One model request at a time keeps the 8 GB development computer responsive.
export async function withModelCapacity(work) {
  if (generating) throw new AssistantError('The local assistant is answering another question. Please try again shortly.', 429, 'ASSISTANT_BUSY')
  generating = true
  try { return await work() } finally { generating = false }
}

export async function ollamaChat(messages, { tools, format, signal, fetchImpl = fetch, env = process.env } = {}) {
  const config = assistantConfig(env)
  if (!config.enabled) throw new AssistantError('The local assistant is disabled.')
  try {
    const status = await assistantStatus({ fetchImpl, env })
    if (!status.available) throw new AssistantError(status.message)
    const metadataResponse = await fetchImpl(`${config.url}/api/show`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
      signal: AbortSignal.timeout(5000), body: JSON.stringify({ model: config.model }),
    })
    if (!metadataResponse.ok) throw new AssistantError('The local model could not be verified.')
    const metadata = await metadataResponse.json()
    if (metadata.remote_host || metadata.remote_model || metadata.remote) {
      throw new AssistantError('Cloud-backed Ollama models are disabled for this assistant.', 503, 'LOCAL_MODEL_REQUIRED')
    }
    const response = await fetchImpl(`${config.url}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000),
      body: JSON.stringify({ model: config.model, messages, ...(tools?.length ? { tools } : {}), ...(format ? { format } : {}), stream: false,
        keep_alive: '5m', options: { temperature: 0.15, num_ctx: 4096, num_predict: 220 } }),
    })
    if (!response.ok) throw new AssistantError(response.status === 404
      ? 'The configured model is not installed. Start Ollama and install the model listed in the setup guide.'
      : 'Ollama could not answer this question. Please try again.')
    const result = await response.json()
    if (!result.message || typeof result.message !== 'object') throw new AssistantError('The model returned an incomplete answer. Please try again.')
    return result.message
  } catch (error) {
    if (error instanceof AssistantError) throw error
    if (signal?.aborted) throw new AssistantError('The request was canceled.', 499, 'ASSISTANT_CANCELED')
    if (['TimeoutError', 'AbortError'].includes(error.name)) throw new AssistantError('The local model took too long. Try a shorter question.', 504, 'ASSISTANT_TIMEOUT')
    throw new AssistantError('Ollama is offline. Start Ollama on the backend computer and try again.')
  }
}
