import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/role-guard'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'
import { loadProviderConfig, createWhatsAppProvider } from '@/lib/whatsapp-provider/factory'

export async function POST(request: NextRequest) {
  const { error: authError, user } = await requireManager()
  if (authError) return authError
  const orgId = user?.organizationId || null

  // Evolution orgs: retorna número conectado via instância
  const providerConfig = await loadProviderConfig(orgId)
  if (providerConfig?.type === 'evolution') {
    try {
      const provider = await createWhatsAppProvider(orgId)
      const status = await provider.getConnectionStatus()
      if (!status.connected) return NextResponse.json([])
      return NextResponse.json([{
        id: providerConfig.evolutionInstance || 'SmartZap',
        display_phone_number: status.phone || '',
        verified_name: status.name || providerConfig.evolutionInstance || 'SmartZap',
        quality_rating: 'GREEN',
        provider: 'evolution',
      }])
    } catch (error) {
      console.error('Evolution getConnectionStatus error:', error)
      return NextResponse.json([])
    }
  }

  let businessAccountId: string | undefined
  let accessToken: string | undefined

  // Try to get from request body first
  try {
    const body = await request.json()
    businessAccountId = body.businessAccountId
    accessToken = body.accessToken
  } catch {
    // No body provided, will fallback to Redis
  }

  // Fallback to Redis credentials if not provided
  if (!businessAccountId || !accessToken) {
    const credentials = await getWhatsAppCredentials(orgId)
    if (credentials) {
      businessAccountId = credentials.businessAccountId
      accessToken = credentials.accessToken
    }
  }

  if (!businessAccountId || !accessToken) {
    return NextResponse.json(
      { error: 'Credenciais não configuradas. Configure em Ajustes.' }, 
      { status: 401 }
    )
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v24.0/${businessAccountId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,webhook_configuration`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch phone numbers' }, 
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data.data || [])
  } catch (error) {
    console.error('Error fetching phone numbers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Also support GET for simpler access
export async function GET() {
  const { error: authError, user } = await requireManager()
  if (authError) return authError
  const orgId = user?.organizationId || null

  // Evolution orgs: retorna número conectado via instância
  const providerConfig = await loadProviderConfig(orgId)
  if (providerConfig?.type === 'evolution') {
    try {
      const provider = await createWhatsAppProvider(orgId)
      const status = await provider.getConnectionStatus()
      if (!status.connected) return NextResponse.json([])
      return NextResponse.json([{
        id: providerConfig.evolutionInstance || 'SmartZap',
        display_phone_number: status.phone || '',
        verified_name: status.name || providerConfig.evolutionInstance || 'SmartZap',
        quality_rating: 'GREEN',
        provider: 'evolution',
      }])
    } catch (error) {
      console.error('Evolution getConnectionStatus error:', error)
      return NextResponse.json([])
    }
  }

  const credentials = await getWhatsAppCredentials(orgId)
  
  if (!credentials) {
    return NextResponse.json(
      { error: 'Credenciais não configuradas. Configure em Ajustes.' }, 
      { status: 401 }
    )
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v24.0/${credentials.businessAccountId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,webhook_configuration`,
      { headers: { 'Authorization': `Bearer ${credentials.accessToken}` } }
    )

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch phone numbers' }, 
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data.data || [])
  } catch (error) {
    console.error('Error fetching phone numbers:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
