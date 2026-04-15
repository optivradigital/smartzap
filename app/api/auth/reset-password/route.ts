/**
 * Reset Password API
 * POST: Validate token and update password
 */

import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { supabase } from '@/lib/supabase'
import { hashPassword } from '@/lib/multi-user-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    const redisKey = `reset:token:${token}`

    // Look up token in Redis
    const email = await redis.get<string>(redisKey)

    if (!email) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 400 })
    }

    // Find user by email
    const { data: user } = await supabase
      .from('smartzap_users')
      .select('id')
      .eq('email', email)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 400 })
    }

    // Hash and update password
    const passwordHash = hashPassword(password)
    const { error: updateError } = await supabase
      .from('smartzap_users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id)

    if (updateError) {
      console.error('[reset-password] Update error:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar senha' }, { status: 500 })
    }

    // Delete the token from Redis (single use)
    await redis.del(redisKey)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[reset-password] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
