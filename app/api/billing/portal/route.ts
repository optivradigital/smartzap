import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/clerk-auth'
import { stripe } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!user.organizationId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 400 })

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', user.organizationId)
    .single()

  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: 'Nenhuma assinatura ativa' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${appUrl}/settings/billing`,
  })

  return NextResponse.json({ url: session.url })
}
