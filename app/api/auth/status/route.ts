/**
 * Auth Status API — Multi-User
 * GET: Check if the session is valid (any authenticated user)
 */

import { NextResponse } from 'next/server'
import { validateMultiUserSession, getCurrentUser } from '@/lib/multi-user-auth'
import { isSetupComplete } from '@/lib/user-auth'

// Node.js runtime (not edge) — required for crypto/pbkdf2
export const runtime = 'nodejs'

export async function GET() {
  try {
    const isConfigured = !!process.env.MASTER_PASSWORD
    const isSetup = await isSetupComplete()
    const isAuthenticated = await validateMultiUserSession()
    const user = isAuthenticated ? await getCurrentUser() : null

    return NextResponse.json({
      isConfigured,
      isSetup,
      isAuthenticated,
      user,
      // legacy compat
      company: user ? { name: user.name || user.email, email: user.email } : null,
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json({ isConfigured: false, isSetup: false, isAuthenticated: false, company: null }, { status: 500 })
  }
}
