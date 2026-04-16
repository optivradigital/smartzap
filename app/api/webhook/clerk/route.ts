/**
 * Clerk Webhook Handler
 *
 * Syncs Clerk user events to the smartzap_users table.
 * Events handled: user.created, user.updated, user.deleted
 *
 * Setup: configure the webhook URL in Clerk Dashboard
 *   https://dashboard.clerk.com → Webhooks → Add endpoint
 *   URL: https://smartzap.optivra.digital/api/webhook/clerk
 *   Events: user.created, user.updated, user.deleted
 *
 * Required env var: CLERK_WEBHOOK_SECRET (from Clerk Dashboard → Webhooks → Signing Secret)
 */

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ClerkEmailAddress {
  email_address: string
  id: string
}

interface ClerkUserPayload {
  id: string
  email_addresses: ClerkEmailAddress[]
  primary_email_address_id: string
  first_name: string | null
  last_name: string | null
  created_at: number
  updated_at: number
}

function getPrimaryEmail(payload: ClerkUserPayload): string {
  const primary = payload.email_addresses.find(
    (e) => e.id === payload.primary_email_address_id
  )
  return primary?.email_address ?? payload.email_addresses[0]?.email_address ?? ''
}

function getFullName(payload: ClerkUserPayload): string {
  const parts = [payload.first_name, payload.last_name].filter(Boolean)
  return parts.join(' ') || ''
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SECRET não configurado')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Verify signature
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const body = await req.text()

  let event: { type: string; data: ClerkUserPayload }
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: ClerkUserPayload }
  } catch (err) {
    console.error('[clerk-webhook] Assinatura inválida:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = event
  console.log(`[clerk-webhook] Evento: ${type} — userId: ${data.id}`)

  try {
    if (type === 'user.created') {
      const email = getPrimaryEmail(data)
      const name = getFullName(data)

      // Check if already exists (e.g. pre-created during migration)
      const { data: existing } = await supabase
        .from('smartzap_users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single()

      if (!existing) {
        const { error } = await supabase.from('smartzap_users').insert({
          email: email.toLowerCase(),
          name: name || email,
          role: 'user',
          password_hash: '', // no longer used with Clerk
          created_at: new Date(data.created_at).toISOString(),
        })
        if (error) {
          console.error('[clerk-webhook] Erro ao criar usuário:', error.message)
        } else {
          console.log(`[clerk-webhook] Usuário criado: ${email}`)
        }
      } else {
        console.log(`[clerk-webhook] Usuário já existe: ${email}`)
      }
    }

    if (type === 'user.updated') {
      const email = getPrimaryEmail(data)
      const name = getFullName(data)

      if (email && name) {
        await supabase
          .from('smartzap_users')
          .update({ name })
          .eq('email', email.toLowerCase())
      }
    }

    // user.deleted: we keep the smartzap_users record for audit/data integrity
    // but could add soft-delete here if needed

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[clerk-webhook] Erro interno:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
