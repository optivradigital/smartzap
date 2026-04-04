import { NextRequest, NextResponse } from 'next/server'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { requireAnyUser } from '@/lib/role-guard'

// Tier limits mapping
const TIER_LIMITS: Record<string, number> = {
  'TIER_250': 250,
  'TIER_1K': 1000,
  'TIER_2K': 2000,
  'TIER_10K': 10000,
  'TIER_100K': 100000,
  'TIER_UNLIMITED': Infinity,
}

// Shared logic to fetch limits from Meta API
async function fetchLimitsFromMeta(phoneNumberId: string, accessToken: string) {
  // Parallel fetch for throughput/quality and messaging tier
  const [throughputResponse, tierResponse] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=throughput,quality_score`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    ),
    fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=whatsapp_business_manager_messaging_limit`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    ),
  ])

  if (!throughputResponse.ok || !tierResponse.ok) {
    const errorThroughput = !throughputResponse.ok ? await throughputResponse.text() : null
    const errorTier = !tierResponse.ok ? await tierResponse.text() : null
    console.error('❌ Failed to fetch account limits from Meta:', { errorThroughput, errorTier })
    throw new Error('Failed to fetch limits from Meta API')
  }

  const [throughputData, tierData] = await Promise.all([
    throughputResponse.json(),
    tierResponse.json(),
  ])

  // Parse throughput level
  const throughputLevel = throughputData.throughput?.level === 'high' ? 'HIGH' : 'STANDARD'
  
  // Parse quality score
  const rawQuality = throughputData.quality_score?.score?.toUpperCase()
  const qualityScore = ['GREEN', 'YELLOW', 'RED'].includes(rawQuality) ? rawQuality : 'UNKNOWN'
  
  // Parse messaging tier
  let messagingTier = 'TIER_250'
  const rawTier = tierData.whatsapp_business_manager_messaging_limit
  
  if (typeof rawTier === 'string') {
    messagingTier = rawTier
  } else if (rawTier && typeof rawTier === 'object') {
    messagingTier = rawTier.current_limit || rawTier.tier || rawTier.limit || 'TIER_250'
  }
  
  const maxUniqueUsersPerDay = TIER_LIMITS[messagingTier] || 250

  return {
    messagingTier,
    maxUniqueUsersPerDay: maxUniqueUsersPerDay === Infinity ? -1 : maxUniqueUsersPerDay,
    throughputLevel,
    maxMessagesPerSecond: throughputLevel === 'HIGH' ? 1000 : 80,
    qualityScore,
    usedToday: 0,
    lastFetched: new Date().toISOString(),
  }
}

// GET /api/account/limits - Fetch limits using Redis credentials
export async function GET() {
  const { error: authError, user } = await requireAnyUser()
  if (authError) return authError
  const orgId = user.organizationId || null

  const credentials = await getWhatsAppCredentials(orgId)
  
  if (!credentials?.phoneNumberId || !credentials?.accessToken) {
    return NextResponse.json({ 
      error: 'NO_CREDENTIALS',
      message: 'Credenciais do WhatsApp não configuradas. Configure em Ajustes.'
    }, { status: 401 })
  }

  try {
    const limits = await fetchLimitsFromMeta(credentials.phoneNumberId, credentials.accessToken)
    return NextResponse.json(limits)
  } catch (error) {
    console.error('❌ Error fetching account limits:', error)
    return NextResponse.json({
      error: 'FETCH_FAILED',
      message: 'Não foi possível buscar os limites da sua conta na Meta.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 502 })
  }
}

// POST /api/account/limits - Fetch limits (with optional body credentials, fallback to Redis)
export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireAnyUser()
  if (authError) return authError
  const orgId = user.organizationId || null

  let phoneNumberId: string | undefined
  let accessToken: string | undefined

  // Try to get from request body first
  try {
    const body = await request.json()
    // Only use if they look like real credentials (not masked)
    if (body.phoneNumberId && body.accessToken && !body.accessToken.includes('***')) {
      phoneNumberId = body.phoneNumberId
      accessToken = body.accessToken
    }
  } catch {
    // No body provided, will fallback to Redis
  }

  // Fallback to Redis credentials if not provided
  if (!phoneNumberId || !accessToken) {
    const credentials = await getWhatsAppCredentials(orgId)
    if (credentials) {
      phoneNumberId = credentials.phoneNumberId
      accessToken = credentials.accessToken
    }
  }

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json({ 
      error: 'NO_CREDENTIALS',
      message: 'Credenciais do WhatsApp não configuradas. Configure em Ajustes.'
    }, { status: 401 })
  }

  try {
    const limits = await fetchLimitsFromMeta(phoneNumberId, accessToken)
    return NextResponse.json(limits)
  } catch (error) {
    console.error('❌ Error fetching account limits:', error)
    return NextResponse.json({
      error: 'API_ERROR',
      message: 'Erro ao conectar com a API da Meta. Tente novamente.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
