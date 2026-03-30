import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { db } from '@/lib/db'
import type { AppRole, AppTeam } from '@/lib/constants'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string
  department: string
  email: string
}

interface AuthContextType {
  user: Profile | null
  profile: Profile | null
  role: AppRole | null
  team: AppTeam | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const SESSION_KEY = 'pu_session_user_id'

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<Profile | null>(null)
  const [role, setRole]       = useState<AppRole | null>(null)
  const [team, setTeam]       = useState<AppTeam | null>(null)
  const [loading, setLoading] = useState(true)

  function applyRecord(record: ReturnType<typeof db.users.findById>) {
    if (!record) return
    setUser({ id: record.id, full_name: record.full_name, email: record.email, department: record.department })
    setRole(record.role)
    setTeam(record.team)
  }

  useEffect(() => {
    const id = localStorage.getItem(SESSION_KEY)
    if (id) applyRecord(db.users.findById(id))
    setLoading(false)
  }, [])

  async function signIn(email: string, password: string) {
    const record = db.users.findByEmail(email)
    if (!record || record.password !== password) throw new Error('Invalid email or password.')
    localStorage.setItem(SESSION_KEY, record.id)
    applyRecord(record)
  }

  async function signUp(_e: string, _p: string, _n: string) {
    throw new Error('Registration is by invitation only.')
  }

  async function signOut() {
    localStorage.removeItem(SESSION_KEY)
    setUser(null); setRole(null); setTeam(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile: user, role, team, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

/** Home route based on role + team */
export function getRoleDashboard(role: AppRole | null, team: AppTeam | null): string {
  if (role === 'super_admin') return '/super-admin/dashboard'
  if (role === 'admin')       return team === 'content' ? '/content/dashboard'   : '/branding/dashboard'
  if (role === 'sub_admin')   return team === 'content' ? '/content/sub-admin'   : '/branding/sub-admin'
  if (role === 'user')        return team === 'content' ? '/content/user'        : '/branding/user'
  return '/login'
}
