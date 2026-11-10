/**
 * Authentication & Authorization Middleware
 * 
 * Provides API key authentication for all API routes
 * Protects against unauthorized access
 */

import { NextRequest, NextResponse } from 'next/server'
import { redis, isRedisAvailable } from './redis'

// ============================================================================
// Types
// ============================================================================

export interface AuthResult {
  valid: boolean
  error?: string
  keyType?: 'admin' | 'api'
}

// ============================================================================
// Constants
// ============================================================================

// Admin endpoints that require special protection
export const ADMIN_ENDPOINTS = [
  '/api/database/init',
  '/api/database/cleanup',
  '/api/database/migrate',
  '/api/database/fix-schema',
]

// Public endpoints that don't require authentication
export const PUBLIC_ENDPOINTS = [
  '/api/webhook',        // Meta webhook verification
  '/api/health',         // Health check
  '/api/system',         // System status (public info only)
  '/api/flows',          // Workflow management (internal dashboard)
  '/api/flow-engine',    // Workflow execution engine (internal)
]

// ============================================================================
// API Key Verification
// ============================================================================

/**
 * Verify API key from request headers
 * 
 * Expects header: Authorization: Bearer <api_key>
 * Or: X-API-Key: <api_key>
 */
export async function verifyApiKey(request: NextRequest): Promise<AuthResult> {
  // Extract API key from headers
  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')

  let apiKey: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.slice(7)
  } else if (apiKeyHeader) {
    apiKey = apiKeyHeader
  }

  if (!apiKey) {
    return {
      valid: false,
      error: 'Missing API key. Use Authorization: Bearer <key> or X-API-Key header'
    }
  }

  // Check against environment variables first (fast path)
  const envApiKey = process.env.SMARTZAP_API_KEY
  const envAdminKey = process.env.SMARTZAP_ADMIN_KEY

  if (envAdminKey && apiKey === envAdminKey) {
    return { valid: true, keyType: 'admin' }
  }

  if (envApiKey && apiKey === envApiKey) {
    return { valid: true, keyType: 'api' }
  }

  // Check Redis for dynamic API keys (if available)
  if (isRedisAvailable() && redis) {
    try {
      const storedKey = await redis.get(`apikey:${apiKey}`)
      if (storedKey) {
        const keyData = JSON.parse(storedKey as string)
        return {
          valid: true,
          keyType: keyData.type || 'api'
        }
      }
    } catch (error) {
      console.error('Redis API key lookup failed:', error)
      // Fall through to env-only validation
    }
  }

  return {
    valid: false,
    error: 'Invalid API key'
  }
}

/**
 * Check if request is for an admin endpoint
 */
export function isAdminEndpoint(pathname: string): boolean {
  return ADMIN_ENDPOINTS.some(endpoint => pathname.startsWith(endpoint))
}

/**
 * Check if request is for a public endpoint
 */
export function isPublicEndpoint(pathname: string): boolean {
  return PUBLIC_ENDPOINTS.some(endpoint => pathname.startsWith(endpoint))
}

/**
 * Verify admin access
 * Returns true if request has admin-level API key
 */
export async function verifyAdminAccess(request: NextRequest): Promise<AuthResult> {
  const authResult = await verifyApiKey(request)

  if (!authResult.valid) {
    return authResult
  }

  if (authResult.keyType !== 'admin') {
    return {
      valid: false,
      error: 'Admin access required for this endpoint'
    }
  }

  return authResult
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message,
      hint: 'Include Authorization: Bearer <api_key> header'
    },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="SmartZap API"'
      }
    }
  )
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message
    },
    { status: 403 }
  )
}

// ============================================================================
// API Key Management
// ============================================================================

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const prefix = 'szap_'
  let key = prefix

  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return key
}

/**
 * Store an API key in Redis
 */
export async function storeApiKey(
  key: string,
  type: 'api' | 'admin' = 'api',
  expiresInDays?: number
): Promise<boolean> {
  if (!isRedisAvailable() || !redis) {
    console.warn('Redis not available, cannot store API key')
    return false
  }

  try {
    const data = JSON.stringify({
      type,
      createdAt: new Date().toISOString(),
    })

    if (expiresInDays) {
      await redis.set(`apikey:${key}`, data, { ex: expiresInDays * 24 * 60 * 60 })
    } else {
      await redis.set(`apikey:${key}`, data)
    }

    return true
  } catch (error) {
    console.error('Failed to store API key:', error)
    return false
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(key: string): Promise<boolean> {
  if (!isRedisAvailable() || !redis) {
    return false
  }

  try {
    await redis.del(`apikey:${key}`)
    return true
  } catch (error) {
    console.error('Failed to revoke API key:', error)
    return false
  }
}
