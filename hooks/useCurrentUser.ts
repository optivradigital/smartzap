/**
 * Hook: useCurrentUser
 * Returns the authenticated user with role info from /api/auth/status
 * For super_admin: also exposes organizations list and activeOrgId for org switcher
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'manager' | 'user'
  isSuperAdmin: boolean
  organizationId?: string
}

export interface OrgOption {
  id: string
  name: string
  slug: string
}

export interface AuthStatusResponse {
  user: CurrentUser | null
  organizations: OrgOption[]
  activeOrgId: string | null
}

async function fetchCurrentUser(): Promise<AuthStatusResponse> {
  const res = await fetch('/api/auth/status', { credentials: 'include' })
  if (!res.ok) return { user: null, organizations: [], activeOrgId: null }
  const data = await res.json()
  if (!data.isAuthenticated || !data.user) return { user: null, organizations: [], activeOrgId: null }
  return {
    user: data.user as CurrentUser,
    organizations: (data.organizations || []) as OrgOption[],
    activeOrgId: data.activeOrgId || null,
  }
}

export function useCurrentUser() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<AuthStatusResponse>({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 0,          // always refetch — role must be fresh after login/logout
    gcTime: 0,             // don't cache between sessions
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  })

  const user = data?.user ?? null
  const organizations = data?.organizations ?? []
  const activeOrgId = data?.activeOrgId ?? null

  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin'
  const isManager = isSuperAdmin || user?.role === 'manager'
  const isUser = isManager || user?.role === 'user'

  const switchOrg = async (orgId: string) => {
    await fetch('/api/auth/switch-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orgId }),
    })
    // Invalidate all queries so everything refetches with new org context
    await queryClient.invalidateQueries()
  }

  return { user, isLoading, isSuperAdmin, isManager, isUser, organizations, activeOrgId, switchOrg }
}
