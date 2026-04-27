import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getHealthStatus } from '@/lib/health-check'
import { getCurrentUser } from '@/lib/clerk-auth'
import { supabase } from '@/lib/supabase'
import { DashboardShell } from './DashboardShell'
import { TrialExpiredBanner } from './TrialExpiredBanner'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [clerkUser, smartzapUser, healthStatus] = await Promise.all([
    currentUser(),
    getCurrentUser(),
    getHealthStatus({ checkExternal: false, checkPing: false }),
  ])

  if (!clerkUser) redirect('/login')

  const email = clerkUser.emailAddresses?.[0]?.emailAddress ?? ''
  const name = clerkUser.firstName
    ? `${clerkUser.firstName} ${clerkUser.lastName ?? ''}`.trim()
    : email

  let trialExpired = false
  let trialDaysLeft: number | null = null
  if (smartzapUser?.organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('trial_ends_at, subscription_status')
      .eq('id', smartzapUser.organizationId)
      .maybeSingle()

    if (org?.subscription_status === 'trial' && org?.trial_ends_at) {
      const now = new Date()
      const trialEnd = new Date(org.trial_ends_at)
      const diffMs = trialEnd.getTime() - now.getTime()
      trialDaysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      trialExpired = diffMs <= 0
    }
  }

  const authStatus = {
    isSetup: true,
    isAuthenticated: true,
    company: { name, email },
  }

  return (
    <DashboardShell
      initialAuthStatus={authStatus}
      initialHealthStatus={healthStatus}
    >
      {trialDaysLeft !== null && trialDaysLeft <= 7 && (
        <TrialExpiredBanner daysLeft={trialDaysLeft} expired={trialExpired} />
      )}
      {children}
    </DashboardShell>
  )
}
