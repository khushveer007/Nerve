import { Navigate } from 'react-router-dom'
import { useAuth, getRoleDashboard } from '@/hooks/useAuth'
import type { AppRole } from '@/lib/constants'

interface RoleGuardProps {
  allowed: AppRole[]
  team?: string           // if set, user must belong to this team (super_admin bypasses)
  children: React.ReactNode
}

export default function RoleGuard({ allowed, team, children }: RoleGuardProps) {
  const { role, team: userTeam, loading } = useAuth()

  if (loading) return null

  const roleOk = role && allowed.includes(role)
  const teamOk = !team || role === 'super_admin' || userTeam === team

  if (!roleOk || !teamOk) {
    return <Navigate to={getRoleDashboard(role, userTeam)} replace />
  }

  return <>{children}</>
}
