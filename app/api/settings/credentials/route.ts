import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/role-guard'
import { getCurrentUser } from '@/lib/clerk-auth'
import { loadProviderConfig } from '@/lib/whatsapp-provider/factory'

/**
 * GET /api/settings/credentials
 * Returns WhatsApp connection info scoped to the current org.
 * Reads from per-org Redis config (not global env vars).
 */
export async function GET() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId
    const config = await loadProviderConfig(orgId)

    if (!config || (!config.phoneNumberId && !config.evolutionUrl)) {
      return NextResponse.json({ source: 'none', isConnected: false })
    }

    if (config.type === 'evolution') {
      return NextResponse.json({
        source: 'redis',
        isConnected: true,
        providerType: 'evolution',
        evolutionUrl: config.evolutionUrl || '',
        evolutionInstance: config.evolutionInstance || '',
      })
    }

    // Meta Cloud API — fetch display info from Meta
    const phoneNumberId = config.phoneNumberId || ''
    const accessToken = config.accessToken || ''

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ source: 'none', isConnected: false })
    }

    let displayPhoneNumber: string | undefined
    let verifiedName: string | undefined
    let qualityRating: string | undefined
    let messagingLimit: string | undefined

    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (metaRes.ok) {
        const d = await metaRes.json()
        displayPhoneNumber = d.display_phone_number
        verifiedName = d.verified_name
        qualityRating = d.quality_rating
        messagingLimit = d.messaging_limit_tier
      }
    } catch { /* ignore — just won't have display details */ }

    return NextResponse.json({
      source: 'redis',
      isConnected: true,
      providerType: 'meta',
      phoneNumberId,
      businessAccountId: config.businessAccountId || '',
      displayPhoneNumber,
      verifiedName,
      qualityRating,
      messagingLimit,
      hasToken: true,
      tokenPreview: accessToken.slice(0, 8) + '••••••',
    })
  } catch (error) {
    console.error('[settings/credentials] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
  }
}

/**
 * POST /api/settings/credentials
 * Validates credentials (legacy — now handled via /api/whatsapp/provider)
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const body = await request.json()
    const { phoneNumberId, businessAccountId, accessToken } = body

    if (!phoneNumberId || !businessAccountId || !accessToken) {
      return NextResponse.json({ error: 'Campos obrigatórios: phoneNumberId, businessAccountId, accessToken' }, { status: 400 })
    }

    // Validate against Meta API
    const metaRes = await fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}))
      return NextResponse.json({ error: 'Credenciais inválidas', details: err }, { status: 400 })
    }

    const metaData = await metaRes.json()
    return NextResponse.json({
      valid: true,
      display_phone_number: metaData.display_phone_number,
      verified_name: metaData.verified_name,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to validate credentials' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/credentials
 * Disconnects WhatsApp for the current org.
 */
export async function DELETE() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId
    const { saveProviderConfig } = await import('@/lib/whatsapp-provider/factory')
    await saveProviderConfig({ type: 'meta', phoneNumberId: '', accessToken: '', businessAccountId: '' }, orgId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
