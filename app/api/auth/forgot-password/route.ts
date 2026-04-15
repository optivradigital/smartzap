/**
 * Forgot Password API
 * POST: Generate a reset token and send reset email
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { redis } from '@/lib/redis'
import { supabase } from '@/lib/supabase'

const RESET_TOKEN_TTL = 60 * 60 // 1 hour in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      // Return success regardless to avoid email enumeration
      return NextResponse.json({ success: true })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user exists
    const { data: user } = await supabase
      .from('smartzap_users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single()

    // Always return success to avoid email enumeration
    if (!user) {
      return NextResponse.json({ success: true })
    }

    // Generate reset token
    const token = randomUUID()
    const redisKey = `reset:token:${token}`

    // Store token in Redis with 1h TTL
    await redis.set(redisKey, normalizedEmail, { ex: RESET_TOKEN_TTL })

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    // Send email via Resend if API key is available
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'SmartZap <noreply@smartzap.app>',
            to: normalizedEmail,
            subject: 'Redefinição de senha — SmartZap',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px">
                <h2 style="color:#10b981;margin-bottom:8px">SmartZap</h2>
                <p>Recebemos um pedido para redefinir sua senha.</p>
                <p>Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
                <a href="${resetUrl}" style="display:inline-block;margin:24px 0;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
                  Redefinir senha
                </a>
                <p style="color:#6b7280;font-size:13px">Se você não solicitou isso, ignore este e-mail.</p>
                <p style="color:#9ca3af;font-size:12px">Ou copie o link: ${resetUrl}</p>
              </div>
            `,
          }),
        })
      } catch (emailError) {
        console.error('[forgot-password] Failed to send email via Resend:', emailError)
      }
    } else {
      // Fallback: log the reset link
      console.log(`[forgot-password] Reset link for ${normalizedEmail}: ${resetUrl}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[forgot-password] Error:', error)
    return NextResponse.json({ success: true })
  }
}
