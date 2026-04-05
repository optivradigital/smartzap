import Redis from 'ioredis'

export function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL
}

let ioredisClient: Redis | null = null

if (isRedisAvailable()) {
  ioredisClient = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: false,
  })

  ioredisClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message)
  })
}

function serialize(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function deserialize<T>(value: string | null): T | null {
  if (value === null) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return value as unknown as T
  }
}

export const redis = {
  get: async <T = unknown>(key: string): Promise<T | null> => {
    if (!ioredisClient) return null
    const val = await ioredisClient.get(key)
    return deserialize<T>(val)
  },
  set: async (key: string, value: unknown, options?: { ex?: number; nx?: boolean }): Promise<string | null> => {
    if (!ioredisClient) return null
    const serialized = serialize(value)
    if (options?.ex && options?.nx) {
      return ioredisClient.set(key, serialized, 'EX', options.ex, 'NX')
    }
    if (options?.ex) {
      return ioredisClient.set(key, serialized, 'EX', options.ex)
    }
    if (options?.nx) {
      return ioredisClient.set(key, serialized, 'NX')
    }
    return ioredisClient.set(key, serialized)
  },
  setex: async (key: string, seconds: number, value: unknown): Promise<string> => {
    if (!ioredisClient) return 'OK'
    return ioredisClient.setex(key, seconds, serialize(value))
  },
  del: async (key: string): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.del(key)
  },
  hget: async (key: string, field: string): Promise<string | null> => {
    if (!ioredisClient) return null
    return ioredisClient.hget(key, field)
  },
  hset: async (key: string, obj: Record<string, unknown>): Promise<number> => {
    if (!ioredisClient) return 0
    const args: (string | number | Buffer)[] = []
    for (const [field, value] of Object.entries(obj)) {
      args.push(field, serialize(value))
    }
    return ioredisClient.hset(key, ...args)
  },
  hdel: async (key: string, ...fields: string[]): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.hdel(key, ...fields)
  },
  hgetall: async <T = Record<string, string>>(key: string): Promise<T | null> => {
    if (!ioredisClient) return null
    const result = await ioredisClient.hgetall(key)
    if (!result || Object.keys(result).length === 0) return null
    return result as unknown as T
  },
  incr: async (key: string): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.incr(key)
  },
  expire: async (key: string, seconds: number): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.expire(key, seconds)
  },
  exists: async (...keys: string[]): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.exists(...keys)
  },
  keys: async (pattern: string): Promise<string[]> => {
    if (!ioredisClient) return []
    return ioredisClient.keys(pattern)
  },
  scan: async (cursor: number | string, matchPattern?: string, count?: number): Promise<[string, string[]]> => {
    if (!ioredisClient) return ['0', []]
    const args: (string | number)[] = [String(cursor)]
    if (matchPattern) { args.push('MATCH', matchPattern) }
    if (count) { args.push('COUNT', count) }
    return ioredisClient.scan(...(args as Parameters<typeof ioredisClient.scan>))
  },
  ping: async (): Promise<string> => {
    if (!ioredisClient) throw new Error('Redis not configured')
    return ioredisClient.ping()
  },
  dbsize: async (): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.dbsize()
  },
  type: async (key: string): Promise<string> => {
    if (!ioredisClient) return 'none'
    return ioredisClient.type(key)
  },
  ttl: async (key: string): Promise<number> => {
    if (!ioredisClient) return -2
    return ioredisClient.ttl(key)
  },
  lpush: async (key: string, ...values: unknown[]): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.lpush(key, ...values.map(serialize))
  },
  rpush: async (key: string, ...values: unknown[]): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.rpush(key, ...values.map(serialize))
  },
  lrange: async (key: string, start: number, stop: number): Promise<string[]> => {
    if (!ioredisClient) return []
    return ioredisClient.lrange(key, start, stop)
  },
  llen: async (key: string): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.llen(key)
  },
  hincrby: async (key: string, field: string, increment: number): Promise<number> => {
    if (!ioredisClient) return 0
    return ioredisClient.hincrby(key, field, increment)
  },
  mget: async (...keys: string[]): Promise<(string | null)[]> => {
    if (!ioredisClient) return keys.map(() => null)
    return ioredisClient.mget(...keys)
  },
}

// =============================================================================
// CONVERSATION STATE
// =============================================================================

export interface ConversationState {
  conversationId: string
  botId: string
  currentNodeId?: string
  status: 'active' | 'paused' | 'ended'
  variables: Record<string, string>
  lastMessageAt: string
  cswStartedAt?: string
}

export async function getConversationState(conversationId: string): Promise<ConversationState | null> {
  if (!ioredisClient) return null
  return await redis.get<ConversationState>(`conversation:${conversationId}`)
}

export async function setConversationState(state: ConversationState): Promise<void> {
  if (!ioredisClient) return
  await redis.set(`conversation:${state.conversationId}`, state)
}

export async function deleteConversationState(conversationId: string): Promise<void> {
  if (!ioredisClient) return
  await redis.del(`conversation:${conversationId}`)
}

// =============================================================================
// CONVERSATION VARIABLES
// =============================================================================

export async function getConversationVariables(conversationId: string): Promise<Record<string, string> | null> {
  if (!ioredisClient) return null
  return await redis.hgetall<Record<string, string>>(`conversation:${conversationId}:vars`)
}

export async function setConversationVariables(conversationId: string, variables: Record<string, string>): Promise<void> {
  if (!ioredisClient) return
  if (Object.keys(variables).length === 0) return
  await redis.hset(`conversation:${conversationId}:vars`, variables)
}

export async function setConversationVariable(conversationId: string, key: string, value: string): Promise<void> {
  if (!ioredisClient) return
  await redis.hset(`conversation:${conversationId}:vars`, { [key]: value })
}

// =============================================================================
// RATE LIMITING
// =============================================================================

export async function checkPairRateLimit(phoneNumberId: string, recipientPhone: string): Promise<boolean> {
  if (!ioredisClient) return true

  const key = `ratelimit:${phoneNumberId}:${recipientPhone}`
  const exists = await redis.exists(key)
  return exists === 0
}

export async function setPairRateLimit(phoneNumberId: string, recipientPhone: string): Promise<void> {
  if (!ioredisClient) return

  const key = `ratelimit:${phoneNumberId}:${recipientPhone}`
  await redis.set(key, '1', { ex: 5 })
}

export async function getPairRateLimitTTL(phoneNumberId: string, recipientPhone: string): Promise<number> {
  if (!ioredisClient) return 0
  const key = `ratelimit:${phoneNumberId}:${recipientPhone}`
  return await redis.ttl(key)
}

// =============================================================================
// CSW (24h Customer Service Window)
// =============================================================================

export async function checkCSW(phoneNumberId: string, recipientPhone: string): Promise<boolean> {
  if (!ioredisClient) return false

  const key = `csw:${phoneNumberId}:${recipientPhone}`
  const exists = await redis.exists(key)
  return exists === 1
}

export async function setCSW(phoneNumberId: string, recipientPhone: string): Promise<void> {
  if (!ioredisClient) return

  const key = `csw:${phoneNumberId}:${recipientPhone}`
  const now = new Date().toISOString()
  await redis.set(key, now, { ex: 86400 })
}

export async function getCSWStartTime(phoneNumberId: string, recipientPhone: string): Promise<string | null> {
  if (!ioredisClient) return null
  const key = `csw:${phoneNumberId}:${recipientPhone}`
  return await redis.get<string>(key)
}

export async function getCSWTimeRemaining(phoneNumberId: string, recipientPhone: string): Promise<number> {
  if (!ioredisClient) return 0
  const key = `csw:${phoneNumberId}:${recipientPhone}`
  return await redis.ttl(key)
}

// =============================================================================
// FLOW CACHE
// =============================================================================

export async function getFlowFromCache(flowId: string): Promise<unknown | null> {
  if (!ioredisClient) return null
  return await redis.get(`flow:${flowId}`)
}

export async function setFlowInCache(flowId: string, flow: unknown): Promise<void> {
  if (!ioredisClient) return
  await redis.set(`flow:${flowId}`, flow, { ex: 3600 })
}

export async function invalidateFlowCache(flowId: string): Promise<void> {
  if (!ioredisClient) return
  await redis.del(`flow:${flowId}`)
}
