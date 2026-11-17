const commaList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

// MCP has protocol headers and may have a separately configured browser client.
// Keep these additional origins/headers restricted to the MCP endpoint.
export function createApiCorsOptions(allowedOrigins, mcpOrigins = commaList(process.env.ASSISTANT_MCP_ALLOWED_ORIGINS)) {
  return function corsOptions(req, callback) {
    const isMcp = /^\/api\/assistant\/mcp\/?$/.test(req.path || '')
    const origins = isMcp ? [...allowedOrigins, ...mcpOrigins] : allowedOrigins
    callback(null, {
      origin(origin, done) {
        if (!origin || origins.includes(origin.replace(/\/$/, ''))) return done(null, true)
        return done(new Error('Not allowed by cors'))
      },
      credentials: true,
      methods: isMcp ? ['POST', 'OPTIONS'] : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: isMcp ? ['Content-Type', 'Authorization', 'MCP-Protocol-Version', 'MCP-Session-Id', 'Last-Event-ID'] : ['Content-Type', 'Authorization'],
      ...(isMcp ? { exposedHeaders: ['MCP-Protocol-Version', 'MCP-Session-Id', 'Retry-After'] } : {}),
    })
  }
}
