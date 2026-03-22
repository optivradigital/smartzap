/**
 * Login API — Multi-User
 * POST: Login with email + password (falls back to MASTER_PASSWORD for legacy)
 */

import { NextRequest, NextResponse } from 'next/server'
import { loginWithEmail } from '@/lib/multi-user-auth'
import { loginUser, isSetupComplete } from '@/lib/user-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Multi-user path: email provided
    if (email) {
      const result = await loginWithEmail(email, password)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 401 })
      }
      return NextResponse.json({ success: true, user: result.user })
    }

    // Legacy path: password-only (backward compat)
    if (!(await isSetupComplete())) {
      return NextResponse.json({ error: 'Setup não concluído', needsSetup: true }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'Senha é obrigatória' }, { status: 400 })
    }
    const result = await loginUser(password)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }
    return NextResponse.json({ success: true, company: result.company })

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
  }
}
