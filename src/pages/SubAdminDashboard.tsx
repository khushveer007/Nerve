import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/db'
import { Users, FileText, PlusCircle, Search, BarChart2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DEPARTMENTS } from '@/lib/constants'

export default function SubAdminDashboard() {
  const { profile } = useAuth()
  const allEntries  = useMemo(() => db.entries.getAll(), [])
  const allUsers    = useMemo(() => db.users.getAll(), [])
  const [dept, setDept] = useState(profile?.department || '')

  const filtered = useMemo(() =>
    dept ? allEntries.filter(e => e.dept === dept) : allEntries,
    [allEntries, dept]
  )

  const deptUsers = useMemo(() =>
    dept ? allUsers.filter(u => u.department === dept) : allUsers,
    [allUsers, dept]
  )

  const stats = useMemo(() => ({
    total:      filtered.length,
    highlights: filtered.filter(e => e.priority === 'Key highlight').length,
    thisMonth:  filtered.filter(e => {
      const now = new Date()
      const d = new Date(e.entry_date || '')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length,
    members: deptUsers.length,
  }), [filtered, deptUsers])

  const recent = useMemo(() => filtered.slice(0, 6), [filtered])

  return (
    <div className="animate-fade-in space-y-6">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Sub-Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
          </p>
        </div>
        <div className="w-40 shrink-0">
          <select className="hub-input text-xs" value={dept} onChange={e => setDept(e.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: dept ? `${dept} entries` : 'Total entries', value: stats.total,      icon: FileText,  bg: 'bg-green-50',  color: 'text-green-600' },
          { label: 'This month',                               value: stats.thisMonth,  icon: BarChart2, bg: 'bg-blue-50',   color: 'text-blue-600' },
          { label: 'Key highlights',                           value: stats.highlights, icon: FileText,  bg: 'bg-amber-50',  color: 'text-amber-600' },
          { label: dept ? `${dept} members` : 'Total members', value: stats.members,   icon: Users,     bg: 'bg-teal-50',   color: 'text-teal-600' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="hub-card flex items-center gap-3 py-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.bg} shrink-0`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <div className="text-2xl font-serif text-foreground leading-none">{s.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="hub-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Recent entries{dept ? ` · ${dept}` : ''}
            </h2>
            <Link to="/browse" className="text-xs text-primary hover:underline flex items-center gap-1">
              <Search className="w-3 h-3" /> Browse all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No entries found.</p>
          ) : (
            <div className="space-y-0">
              {recent.map(e => (
                <div key={e.id} className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className="hub-badge bg-primary/10 text-primary">{e.dept}</span>
                      <span className="hub-badge bg-primary/5 text-primary/70">{e.type}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{e.entry_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hub-card flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground mb-2">Quick actions</h2>
          {[
            { to: '/add',             icon: PlusCircle, label: 'Add new entry',  desc: 'Create a knowledge entry' },
            { to: '/browse',          icon: Search,     label: 'Browse entries', desc: 'Search all entries' },
            { to: '/sub-admin/panel', icon: Users,      label: 'Manage users',   desc: 'View department members' },
          ].map(({ to, icon: Icon, label, desc }) => (
            <Link key={to} to={to}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
