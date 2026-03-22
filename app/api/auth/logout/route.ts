/**
 * Logout API — Multi-User
 * POST: Logout and clear session
 */

import { NextResponse } from 'next/server'
import { logoutMultiUser } from '@/lib/multi-user-auth'
import { logoutUser } from '@/lib/user-auth'

export const runtime = 'nodejs'

export async function POST() {
  try {
    // Try multi-user logout first, then legacy
    await logoutMultiUser().catch(() => logoutUser())
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
