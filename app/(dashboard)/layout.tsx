import { currentUser } from '@clerk/nextjs/server'
import { getHealthStatus } from '@/lib/health-check'
import { DashboardShell } from './DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [clerkUser, healthStatus] = await Promise.all([
    currentUser(),
    getHealthStatus({ checkExternal: false, checkPing: false }),
  ])

  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? ''
  const name = clerkUser?.firstName
    ? `${clerkUser.firstName} ${clerkUser.lastName ?? ''}`.trim()
    : email

  const authStatus = {
    isSetup: true,
    isAuthenticated: !!clerkUser,
    company: clerkUser ? { name, email } : null,
  }

  return (
    <DashboardShell
      initialAuthStatus={authStatus}
      initialHealthStatus={healthStatus}
    >
      {children}
    </DashboardShell>
  )
}
