/**
 * Hook: useCurrentUser
 * Returns the authenticated user with role info from /api/auth/status
 */
import { useQuery } from '@tanstack/react-query'

export interface CurrentUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'manager' | 'user'
  isSuperAdmin: boolean
  organizationId?: string
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch('/api/auth/status', { credentials: 'include' })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.isAuthenticated || !data.user) return null
  return data.user as CurrentUser
}

export function useCurrentUser() {
  const { data: user, isLoading } = useQuery<CurrentUser | null>({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: false,
  })

  const isSuperAdmin = user?.isSuperAdmin === true || user?.role === 'super_admin'
  const isManager = isSuperAdmin || user?.role === 'manager'
  const isUser = isManager || user?.role === 'user'

  return { user, isLoading, isSuperAdmin, isManager, isUser }
}
