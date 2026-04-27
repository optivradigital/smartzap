import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/clerk-auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!user.organizationId) return NextResponse.json({ subscription: null })

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status, plan, extra_numbers, current_period_end, cancel_at_period_end')
    .eq('organization_id', user.organizationId)
    .single()

  return NextResponse.json({ subscription: subscription ?? null })
}
