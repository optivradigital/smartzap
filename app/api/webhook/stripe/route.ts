import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabase } from '@/lib/supabase'
import type Stripe from 'stripe'

function calculateExtraNumbers(items: Stripe.SubscriptionItem[]): number {
  return items.reduce((sum, item) => {
    if (item.price.id === process.env.STRIPE_PRICE_EXTRA_NUMBER) {
      return sum + (item.quantity ?? 0)
    }
    return sum
  }, 0)
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET não configurado')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Assinatura inválida:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[stripe-webhook] Evento: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const orgId = session.metadata?.organization_id
        const subscriptionId = session.subscription as string
        if (!orgId || !subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = subscription as any
        const extraNumbers = calculateExtraNumbers(subscription.items.data)

        await Promise.all([
          supabase.from('subscriptions').upsert({
            id: orgId,
            organization_id: orgId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            status: 'active',
            plan: 'basic',
            extra_numbers: extraNumbers,
            current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }),
          supabase
            .from('organizations')
            .update({ subscription_status: 'active', stripe_customer_id: session.customer as string })
            .eq('id', orgId),
        ])

        console.log(`[stripe-webhook] Assinatura ativada: ${orgId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subUpdated = subscription as any
        const orgId = subscription.metadata?.organization_id
        if (!orgId) break

        const extraNumbers = calculateExtraNumbers(subscription.items.data)
        const orgStatus = subscription.status === 'active' ? 'active' : 'inactive'

        await Promise.all([
          supabase.from('subscriptions').upsert({
            id: orgId,
            organization_id: orgId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            extra_numbers: extraNumbers,
            current_period_start: subUpdated.current_period_start ? new Date(subUpdated.current_period_start * 1000).toISOString() : null,
            current_period_end: subUpdated.current_period_end ? new Date(subUpdated.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }),
          supabase.from('organizations').update({ subscription_status: orgStatus }).eq('id', orgId),
        ])
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.organization_id
        if (!orgId) break

        await Promise.all([
          supabase
            .from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('organization_id', orgId),
          supabase
            .from('organizations')
            .update({ subscription_status: 'inactive' })
            .eq('id', orgId),
        ])

        console.log(`[stripe-webhook] Assinatura cancelada: ${orgId}`)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] Erro interno:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
