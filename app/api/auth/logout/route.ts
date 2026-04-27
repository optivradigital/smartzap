/**
 * Logout — com Clerk, o logout é feito client-side via signOut().
 * Este endpoint existe apenas para compatibilidade com chamadas antigas.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json({ success: true })
}
