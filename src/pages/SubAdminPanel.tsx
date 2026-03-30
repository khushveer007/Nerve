import { useState, useMemo } from 'react'
import { db } from '@/lib/db'
import { useAuth } from '@/hooks/useAuth'
import { Users, Search, UserCheck } from 'lucide-react'
import { DEPARTMENTS } from '@/lib/constants'

export default function SubAdminPanel() {
  const { profile } = useAuth()
  const allUsers  = useMemo(() => db.users.getAll(), [])
  const [search, setSearch] = useState('')
  const [dept, setDept]     = useState(profile?.department || '')

  const filtered = useMemo(() => {
    let r = allUsers.filter(u => u.role === 'user' || u.role === 'sub_admin')
    if (dept)   r = r.filter(u => u.department === dept)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      )
    }
    return r
  }, [allUsers, dept, search])

  return (
    <div className="animate-fade-in space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
          <UserCheck className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-serif text-foreground">Sub-Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            View users{profile?.department ? ` in ${profile.department}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total visible', value: filtered.length },
          { label: 'Users',         value: filtered.filter(u => u.role === 'user').length },
          { label: 'Sub-admins',    value: filtered.filter(u => u.role === 'sub_admin').length },
        ].map(s => (
          <div key={s.label} className="hub-card flex items-center gap-3 py-3">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <div className="text-xl font-serif text-foreground leading-none">{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hub-card space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input className="hub-input pl-9" placeholder="Search users..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="w-44 shrink-0">
            <select className="hub-input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="hub-card">
        <h2 className="text-sm font-semibold text-foreground mb-4">{filtered.length} members</h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No users found.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map(u => (
              <div key={u.id} className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {(u.full_name || u.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email} {u.department ? `· ${u.department}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`hub-badge shrink-0 ${u.role === 'sub_admin' ? 'bg-teal-100 text-teal-700' : 'bg-green-100 text-green-700'}`}>
                  {u.role === 'sub_admin' ? 'Sub Admin' : 'User'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
