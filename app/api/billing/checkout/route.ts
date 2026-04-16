import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getCurrentUser } from '@/lib/clerk-auth'
import { stripe, STRIPE_PRICE_BASIC, STRIPE_PRICE_EXTRA_NUMBER } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!user.organizationId) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 400 })

  const { extraNumbers = 0 } = await req.json()

  const { data: org } = await supabase
    .from('organizations')
    .select('name, stripe_customer_id')
    .eq('id', user.organizationId)
    .single()

  if (!org) return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })

  // Create or reuse Stripe customer
  let customerId = org.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { organization_id: user.organizationId },
    })
    customerId = customer.id
    await supabase
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.organizationId)
  }

  const lineItems: { price: string; quantity: number }[] = [
    { price: STRIPE_PRICE_BASIC, quantity: 1 },
  ]

  if (extraNumbers > 0 && STRIPE_PRICE_EXTRA_NUMBER) {
    lineItems.push({ price: STRIPE_PRICE_EXTRA_NUMBER, quantity: extraNumbers })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: lineItems,
    success_url: `${appUrl}/settings/billing?success=1`,
    cancel_url: `${appUrl}/settings/billing?canceled=1`,
    metadata: { organization_id: user.organizationId },
    subscription_data: {
      metadata: { organization_id: user.organizationId },
    },
  })

  return NextResponse.json({ url: session.url })
}
