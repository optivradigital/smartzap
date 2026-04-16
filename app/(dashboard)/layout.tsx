import { getCurrentUser } from '@/lib/multi-user-auth'
import { getHealthStatus } from '@/lib/health-check'
import { DashboardShell } from './DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, healthStatus] = await Promise.all([
    getCurrentUser(),
    getHealthStatus({ checkExternal: false, checkPing: false }),
  ])

  const authStatus = {
    isSetup: true,
    isAuthenticated: !!user,
    company: user ? { name: user.name || user.email, email: user.email } : null,
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
