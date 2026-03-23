import { NextRequest, NextResponse } from 'next/server'
import { requireManager } from '@/lib/role-guard'

// Credentials are stored in environment variables (secrets)
// No Redis dependency - env vars are the source of truth

interface WhatsAppCredentials {
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  displayPhoneNumber?: string
  verifiedName?: string
}

// GET - Fetch credentials from env (without exposing full token)
export async function GET() {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_ID
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
    const accessToken = process.env.WHATSAPP_TOKEN

    if (phoneNumberId && businessAccountId && accessToken) {
      // Fetch display phone number from Meta API
      let displayPhoneNumber: string | undefined
      let verifiedName: string | undefined

      try {
        const metaResponse = await fetch(
          `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        )
        if (metaResponse.ok) {
          const metaData = await metaResponse.json()
          displayPhoneNumber = metaData.display_phone_number
          verifiedName = metaData.verified_name
        }
      } catch {
        // Ignore errors, just won't have display number
      }

      return NextResponse.json({
        source: 'env',
        phoneNumberId,
        businessAccountId,
        displayPhoneNumber,
        verifiedName,
        hasToken: true,
        tokenPreview: '••••••••••',
        isConnected: true,
      })
    }

    // Not configured
    return NextResponse.json({
      source: 'none',
      isConnected: false,
    })
  } catch (error) {
    console.error('Error fetching credentials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch credentials' },
      { status: 500 }
    )
  }
}

// POST - Validate credentials (stored in env vars via setup wizard)
export async function POST(request: NextRequest) {
  const { error: authError } = await requireManager()
  if (authError) return authError

  try {
    const body = await request.json()
    const { phoneNumberId, businessAccountId, accessToken } = body

    if (!phoneNumberId || !businessAccountId || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields: phoneNumberId, businessAccountId, accessToken' },
        { status: 400 }
      )
    }

    // Validate token by making a test call to Meta API
    const testResponse = await fetch(
      `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!testResponse.ok) {
      const error = await testResponse.json()
      return NextResponse.json(
        {
          error: 'Invalid credentials - Meta API rejected the token',
          details: error.error?.message || 'Unknown error'
        },
        { status: 401 }
      )
    }

    const phoneData = await testResponse.json()

    // Note: Credentials are stored in Vercel env vars via the setup wizard
    // This endpoint only validates them
    return NextResponse.json({
      success: true,
      phoneNumberId,
      businessAccountId,
      displayPhoneNumber: phoneData.display_phone_number,
      verifiedName: phoneData.verified_name,
      qualityRating: phoneData.quality_rating,
      message: 'Credentials validated. Store them in environment variables.'
    })
  } catch (error) {
    console.error('Error validating credentials:', error)
    return NextResponse.json(
      { error: 'Failed to validate credentials' },
      { status: 500 }
    )
  }
}

// DELETE - No-op since credentials are in env vars
export async function DELETE() {
  return NextResponse.json({
    success: true,
    message: 'To remove credentials, update environment variables in Vercel dashboard.'
  })
}
