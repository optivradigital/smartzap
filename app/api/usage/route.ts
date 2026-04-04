import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { redis, isRedisAvailable } from '@/lib/redis'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { requireManager } from '@/lib/role-guard'

interface UsageData {
  vercel: {
    functionInvocations: number
    functionLimit: number
    functionPercentage: number
    edgeRequests: number
    edgeLimit: number
    edgePercentage: number
    buildMinutes: number
    buildLimit: number
    buildPercentage: number
    percentage: number // highest of the three
    status: 'ok' | 'warning' | 'critical'
  }
  redis: {
    commandsToday: number
    limit: number
    percentage: number
    status: 'ok' | 'warning' | 'critical'
  }
  database: {
    storageMB: number
    limitMB: number
    percentage: number
    rowsRead: number
    rowsWritten: number
    status: 'ok' | 'warning' | 'critical'
  }
  whatsapp: {
    messagesSent: number
    tier: string
    tierLimit: number
    percentage: number
    quality: string
    status: 'ok' | 'warning' | 'critical'
  }
}

function getStatus(percentage: number): 'ok' | 'warning' | 'critical' {
  if (percentage >= 90) return 'critical'
  if (percentage >= 70) return 'warning'
  return 'ok'
}

export async function GET() {
  const { error: authError, user } = await requireManager()
  if (authError) return authError
  const orgId = user.organizationId || null

  const usage: UsageData = {
    vercel: {
      functionInvocations: 0,
      functionLimit: 1000000, // 1M Hobby
      functionPercentage: 0,
      edgeRequests: 0,
      edgeLimit: 10000000, // 10M edge requests
      edgePercentage: 0,
      buildMinutes: 0,
      buildLimit: 6000, // 6000 min = 100h
      buildPercentage: 0,
      percentage: 0,
      status: 'ok',
    },
    redis: { commandsToday: 0, limit: 10000, percentage: 0, status: 'ok' },
    database: { storageMB: 0, limitMB: 500, percentage: 0, rowsRead: 0, rowsWritten: 0, status: 'ok' },
    whatsapp: { messagesSent: 0, tier: 'STANDARD', tierLimit: 100000, percentage: 0, quality: 'GREEN', status: 'ok' },
  }



  // 1. Database Usage (Supabase)
  try {
    // Explicitly create admin client to ensure we bypass RLS
    // The shared client in lib/supabase might be using wrong context or cached
    const { createClient } = await import('@supabase/supabase-js')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!serviceKey || !url) {
      throw new Error('Missing Supabase credentials in Usage API')
    }

    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false }
    })

    const { count: campaignsCount } = await supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })

    const { count: contactsCount } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true })

    const { count: campaignContactsCount } = await supabaseAdmin
      .from('campaign_contacts')
      .select('*', { count: 'exact', head: true })

    const totalRows =
      (campaignsCount || 0) +
      (contactsCount || 0) +
      (campaignContactsCount || 0)

    // Estimate: ~1KB per row average
    const estimatedStorageMB = Math.round((totalRows * 1024) / (1024 * 1024) * 100) / 100

    usage.database.storageMB = estimatedStorageMB
    usage.database.percentage = Math.round((usage.database.storageMB / usage.database.limitMB) * 100 * 10) / 10
    usage.database.status = getStatus(usage.database.percentage)
  } catch (e) {
    console.error('Failed to get Database usage:', e)
  }

  // 2. Redis Usage - Get from Upstash Developer API for real stats
  try {
    const upstashApiKey = process.env.UPSTASH_API_KEY
    const upstashEmail = process.env.UPSTASH_EMAIL
    // Support both DATABASE_ID directly or extracting from console URL
    let upstashDatabaseId = process.env.UPSTASH_DATABASE_ID
    const upstashConsoleUrl = process.env.UPSTASH_CONSOLE_URL

    // Extract database ID from console URL if provided
    // Format: https://console.upstash.com/redis/UUID?teamid=X
    if (!upstashDatabaseId && upstashConsoleUrl) {
      const match = upstashConsoleUrl.match(/\/redis\/([a-f0-9-]{36})/i)
      if (match) {
        upstashDatabaseId = match[1]
      }
    }

    // Try Upstash Developer API first for accurate stats
    if (upstashApiKey && upstashEmail && upstashDatabaseId) {
      try {
        const statsResponse = await fetch(
          `https://api.upstash.com/v2/redis/stats/${upstashDatabaseId}`,
          {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${upstashEmail}:${upstashApiKey}`).toString('base64')}`,
            },
          }
        )

        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          // Use actual API fields: daily_read_requests + daily_write_requests
          const todayCommands = (stats.daily_read_requests || 0) + (stats.daily_write_requests || 0)
          usage.redis.commandsToday = todayCommands

          // Pay-as-you-go plans are unlimited (no max_requests_per_day or it's huge)
          // Check db_request_limit - if it's a huge number, it's unlimited
          const requestLimit = stats.db_request_limit
          if (!requestLimit || requestLimit > 1000000000) {
            // Paid plan - unlimited
            usage.redis.limit = 0 // 0 = unlimited
            usage.redis.percentage = 0
            usage.redis.status = 'ok'
          } else {
            usage.redis.limit = requestLimit
            usage.redis.percentage = Math.round((usage.redis.commandsToday / usage.redis.limit) * 100 * 10) / 10
            usage.redis.status = getStatus(usage.redis.percentage)
          }
        }
      } catch (e) {
        console.error('Failed to get Upstash stats via API:', e)
      }
    }

    // Fallback: just ping Redis to confirm it's working
    if (usage.redis.commandsToday === 0 && isRedisAvailable() && redis) {
      await redis.ping()
      // Assume paid plan (unlimited) if we can ping but couldn't get stats
      usage.redis.limit = 0
      usage.redis.percentage = 0
      usage.redis.status = 'ok'
    }
  } catch (e) {
    console.error('Failed to get Redis usage:', e)
  }

  // 3. WhatsApp Usage - Get from our campaigns + Meta API limits
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('sent, delivered, failed')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const totalSent = campaigns?.reduce((sum, c) => sum + (c.sent || 0), 0) || 0
    usage.whatsapp.messagesSent = totalSent

    // Get tier from WhatsApp API - use correct endpoint
    const credentials = await getWhatsAppCredentials(orgId)
    if (credentials) {
      try {
        // Parallel fetch for tier and quality
        const [tierResponse, qualityResponse] = await Promise.all([
          fetch(
            `https://graph.facebook.com/v24.0/${credentials.phoneNumberId}?fields=whatsapp_business_manager_messaging_limit`,
            { headers: { 'Authorization': `Bearer ${credentials.accessToken}` } }
          ),
          fetch(
            `https://graph.facebook.com/v24.0/${credentials.phoneNumberId}?fields=quality_score`,
            { headers: { 'Authorization': `Bearer ${credentials.accessToken}` } }
          )
        ])

        if (tierResponse.ok) {
          const tierData = await tierResponse.json()
          // Parse messaging tier (can be string or object)
          const rawTier = tierData.whatsapp_business_manager_messaging_limit
          if (typeof rawTier === 'string') {
            usage.whatsapp.tier = rawTier
          } else if (rawTier && typeof rawTier === 'object') {
            usage.whatsapp.tier = rawTier.current_limit || rawTier.tier || 'TIER_250'
          }
        }

        if (qualityResponse.ok) {
          const qualityData = await qualityResponse.json()
          usage.whatsapp.quality = qualityData.quality_score?.score?.toUpperCase() || 'GREEN'
        }

        // Map tier to limit - complete mapping
        const tierLimits: Record<string, number> = {
          'TIER_250': 250,
          'TIER_1K': 1000,
          'TIER_2K': 2000,
          'TIER_10K': 10000,
          'TIER_100K': 100000,
          'TIER_UNLIMITED': 1000000,
          'STANDARD': 100000,
        }
        usage.whatsapp.tierLimit = tierLimits[usage.whatsapp.tier] || 250
      } catch (e) {
        console.error('Failed to get WhatsApp tier:', e)
      }
    }

    usage.whatsapp.percentage = Math.round((usage.whatsapp.messagesSent / usage.whatsapp.tierLimit) * 100 * 10) / 10
    usage.whatsapp.status = getStatus(usage.whatsapp.percentage)
  } catch (e) {
    console.error('Failed to get WhatsApp usage:', e)
  }

  // 4. Vercel Usage - GET /v2/usage with type=requests and type=builds
  try {
    if (process.env.VERCEL_API_TOKEN) {
      const teamId = process.env.VERCEL_TEAM_ID || ''

      // Get first day of current month
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const to = now.toISOString()

      const baseUrl = `https://api.vercel.com/v2/usage?teamId=${teamId}&from=${from}&to=${to}`

      // Fetch requests (function invocations + edge) and builds in parallel
      const [requestsResponse, buildsResponse] = await Promise.all([
        fetch(`${baseUrl}&type=requests`, {
          headers: { 'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}` },
        }),
        fetch(`${baseUrl}&type=builds`, {
          headers: { 'Authorization': `Bearer ${process.env.VERCEL_API_TOKEN}` },
        }),
      ])

      // Process requests data (function invocations + edge)
      if (requestsResponse.ok) {
        const data = await requestsResponse.json()
        if (data.data && Array.isArray(data.data)) {
          for (const day of data.data) {
            // Function invocations
            usage.vercel.functionInvocations += (day.function_invocation_successful_count || 0)
            usage.vercel.functionInvocations += (day.function_invocation_error_count || 0)
            usage.vercel.functionInvocations += (day.function_invocation_throttle_count || 0)
            usage.vercel.functionInvocations += (day.function_invocation_timeout_count || 0)

            // Edge requests (hit + miss)
            usage.vercel.edgeRequests += (day.request_hit_count || 0)
            usage.vercel.edgeRequests += (day.request_miss_count || 0)
          }
        }
      }

      // Process builds data
      if (buildsResponse.ok) {
        const data = await buildsResponse.json()
        if (data.data && Array.isArray(data.data)) {
          for (const day of data.data) {
            usage.vercel.buildMinutes += (day.build_build_seconds || 0)
          }
        }
        // Convert seconds to minutes
        usage.vercel.buildMinutes = Math.round(usage.vercel.buildMinutes / 60)
      }

      // Calculate percentages
      usage.vercel.functionPercentage = Math.round((usage.vercel.functionInvocations / usage.vercel.functionLimit) * 100 * 10) / 10
      usage.vercel.edgePercentage = Math.round((usage.vercel.edgeRequests / usage.vercel.edgeLimit) * 100 * 10) / 10
      usage.vercel.buildPercentage = Math.round((usage.vercel.buildMinutes / usage.vercel.buildLimit) * 100 * 10) / 10

      // Overall percentage is the highest of the three
      usage.vercel.percentage = Math.max(
        usage.vercel.functionPercentage,
        usage.vercel.edgePercentage,
        usage.vercel.buildPercentage
      )
    }

    usage.vercel.status = getStatus(usage.vercel.percentage)
  } catch (e) {
    console.error('Failed to get Vercel usage:', e)
  }

  return NextResponse.json(
    {
      success: true,
      timestamp: new Date().toISOString(),
      period: 'current_month',
      usage,
    },
    {
      headers: {
        // Cache no CDN por 60s - usage stats não precisam ser real-time
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  )
}

// Increment tracking counters (call this from middleware or key routes)
export async function POST() {
  try {
    if (isRedisAvailable() && redis) {
      const today = new Date().toISOString().split('T')[0]

      // Increment Vercel executions counter
      const executionsKey = `usage:vercel:${today}`
      await redis.incr(executionsKey)
      await redis.expire(executionsKey, 86400 * 2) // 2 days TTL

      // Increment Redis commands counter
      const commandsKey = `usage:commands:${today}`
      await redis.incr(commandsKey)
      await redis.expire(commandsKey, 86400 * 2)

      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: 'Redis not available' })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
