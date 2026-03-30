import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/db'
import { Search, Star, BookOpen, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DEPARTMENTS } from '@/lib/constants'

export default function UserDashboard() {
  const { profile } = useAuth()
  const allEntries  = useMemo(() => db.entries.getAll(), [])
  const [search, setSearch] = useState('')
  const [dept, setDept]     = useState('')

  const filtered = useMemo(() => {
    let r = allEntries
    if (dept) r = r.filter(e => e.dept === dept)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(e =>
        e.title?.toLowerCase().includes(q) ||
        e.body?.toLowerCase().includes(q) ||
        e.dept?.toLowerCase().includes(q) ||
        e.type?.toLowerCase().includes(q)
      )
    }
    return r
  }, [allEntries, dept, search])

  const highlights = useMemo(() =>
    allEntries.filter(e => e.priority === 'Key highlight').slice(0, 3),
    [allEntries]
  )

  return (
    <div className="animate-fade-in space-y-6">

      <div>
        <h1 className="text-2xl font-serif text-foreground">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Browse the Parul University knowledge base</p>
      </div>

      <div className="hub-card space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input className="hub-input pl-9" placeholder="Search entries..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="w-44 shrink-0">
            <select className="hub-input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} entries found</p>
      </div>

      {!search && !dept && highlights.length > 0 && (
        <div className="hub-card">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">Key highlights</h2>
          </div>
          <div className="space-y-3">
            {highlights.map(e => (
              <div key={e.id} className="flex gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <BookOpen className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{e.title}</p>
                  <div className="flex gap-1.5 mt-1">
                    <span className="hub-badge bg-amber-100 text-amber-700">{e.dept}</span>
                    <span className="hub-badge bg-amber-50 text-amber-600">{e.type}</span>
                  </div>
                </div>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">{e.entry_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="hub-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            {search || dept ? 'Results' : 'Recent entries'}
          </h2>
          <Link to="/browse" className="text-xs text-primary hover:underline">Advanced search</Link>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No entries match your search.</p>
          </div>
        ) : (
          <div>
            {filtered.slice(0, 20).map(e => (
              <div key={e.id} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                  {e.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{e.body}</p>
                  )}
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span className="hub-badge bg-primary/10 text-primary">{e.dept}</span>
                    <span className="hub-badge bg-primary/5 text-primary/70">{e.type}</span>
                    {e.priority === 'Key highlight' && (
                      <span className="hub-badge bg-amber-100 text-amber-700">Highlight</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{e.entry_date}</span>
              </div>
            ))}
            {filtered.length > 20 && (
              <p className="text-xs text-muted-foreground text-center pt-3">
                Showing 20 of {filtered.length}. <Link to="/browse" className="text-primary hover:underline">Browse all</Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
