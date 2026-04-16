import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials';
import { settingsDb } from '@/lib/supabase-db';
import { getCurrentUser } from '@/lib/clerk-auth';
import { requireManager } from '@/lib/role-guard';

const META_API_VERSION = 'v24.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

interface RouteContext {
  params: Promise<{ phoneNumberId: string }>;
}
// Use the same token source as /api/webhook and /api/webhook/info
async function getVerifyToken(preferredToken?: string): Promise<string> {
  if (preferredToken && preferredToken.trim()) {
    return preferredToken.trim();
  }
  try {
    const storedToken = await settingsDb.get('webhook_verify_token');
    if (storedToken) return storedToken;
    const newToken = crypto.randomUUID();
    await settingsDb.set('webhook_verify_token', newToken);
    return newToken;
  } catch {
    if (process.env.WEBHOOK_VERIFY_TOKEN) return process.env.WEBHOOK_VERIFY_TOKEN.trim();
    return 'not-configured';
  }
}

/**
 * POST /api/phone-numbers/[phoneNumberId]/webhook/override
 * Set webhook override URL for a specific phone number
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { error: authError } = await requireManager();
    if (authError) return authError;
    const { phoneNumberId } = await context.params;
    const currentUser = await getCurrentUser();
    const orgId = currentUser?.organizationId || null;

    // Try to get credentials from request body first, then fallback to Redis
    let accessToken: string | undefined;
    let callbackUrl: string | undefined;
    let verifyTokenFromBody: string | undefined;

    try {
      const body = await request.json();
      // Only use accessToken from body if it's a valid non-empty string
      if (body.accessToken && typeof body.accessToken === 'string' && body.accessToken.trim().length > 10) {
        accessToken = body.accessToken.trim();
      }
      callbackUrl = body.callbackUrl;
      if (body.verifyToken && typeof body.verifyToken === 'string') {
        verifyTokenFromBody = body.verifyToken;
      }
    } catch {
      // Empty body, will use Redis credentials
    }

    // Always try Redis credentials if we don't have a valid token yet
    if (!accessToken) {
      const credentials = await getWhatsAppCredentials(orgId);
      if (credentials?.accessToken) {
        accessToken = credentials.accessToken;
      }
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token não configurado' },
        { status: 401 }
      );
    }
    
    if (!callbackUrl) {
      return NextResponse.json(
        { error: 'callbackUrl é obrigatório' },
        { status: 400 }
      );
    }

    // Get verify token from shared source (ensures consistency with webhook endpoint)
    const verifyToken = await getVerifyToken(verifyTokenFromBody);

    // Call Meta API to set webhook override on phone number
    // Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/override
    const response = await fetch(
      `${META_API_BASE}/${phoneNumberId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook_configuration: {
            override_callback_uri: callbackUrl,
            verify_token: verifyToken,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Meta API error setting webhook override:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Erro ao configurar webhook override',
          details: errorData.error 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook override configurado com sucesso',
      data 
    });

  } catch (error) {
    console.error('Error setting webhook override:', error);
    return NextResponse.json(
      { error: 'Erro interno ao configurar webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/phone-numbers/[phoneNumberId]/webhook/override
 * Remove webhook override for a specific phone number
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { error: authError } = await requireManager();
    if (authError) return authError;
    const { phoneNumberId } = await context.params;
    
    // Try to get credentials from request body first, then fallback to Redis
    let accessToken: string | undefined;
    
    try {
      const body = await request.json();
      // Only use accessToken from body if it's a valid non-empty string
      if (body.accessToken && typeof body.accessToken === 'string' && body.accessToken.trim().length > 10) {
        accessToken = body.accessToken.trim();
      }
    } catch {
      // Empty body, will use Redis credentials
    }
    
    // Always try Redis credentials if we don't have a valid token yet
    const currentUser = await getCurrentUser();
    const orgId = currentUser?.organizationId || null;
    if (!accessToken) {
      const credentials = await getWhatsAppCredentials(orgId);
      if (credentials?.accessToken) {
        accessToken = credentials.accessToken;
      }
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token não configurado' },
        { status: 401 }
      );
    }

    // Call Meta API to remove webhook override (set empty string)
    // Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/override
    const response = await fetch(
      `${META_API_BASE}/${phoneNumberId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook_configuration: {
            override_callback_uri: '',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Meta API error removing webhook override:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Erro ao remover webhook override',
          details: errorData.error 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ 
      success: true, 
      message: 'Webhook override removido com sucesso',
      data 
    });

  } catch (error) {
    console.error('Error removing webhook override:', error);
    return NextResponse.json(
      { error: 'Erro interno ao remover webhook' },
      { status: 500 }
    );
  }
}
