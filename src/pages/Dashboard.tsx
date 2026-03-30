import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/db'
import { DEPARTMENTS } from '@/lib/constants'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { SlidersHorizontal, TrendingUp, LayoutGrid } from 'lucide-react'

const QUICK_RANGES = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y',  days: 365 },
  { label: 'All', days: 0 },
]

type GroupBy = 'daily' | 'weekly' | 'monthly'

function getGroupKey(dateStr: string, group: GroupBy): string {
  if (!dateStr) return 'Unknown'
  if (group === 'monthly') return dateStr.slice(0, 7)
  if (group === 'weekly') {
    const d = new Date(dateStr + 'T00:00:00')
    const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    return d.toISOString().slice(0, 10)
  }
  return dateStr
}

function formatXLabel(key: string, group: GroupBy): string {
  if (group === 'monthly') {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1).toLocaleDateString('en', { month: 'short', year: '2-digit' })
  }
  return key.slice(5).replace('-', '/')
}

function formatTooltipLabel(key: string, group: GroupBy): string {
  if (group === 'monthly') {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
  }
  if (group === 'weekly') return `Week of ${key}`
  return key
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const allEntries = useMemo(() => db.entries.getAll(), [])
  const [dept, setDept]           = useState('')
  const [rangeDays, setRangeDays] = useState(30)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [groupBy, setGroupBy]     = useState<GroupBy>('daily')

  const filtered = useMemo(() => {
    let r = allEntries
    if (dept) r = r.filter(e => e.dept === dept)
    if (startDate && endDate) {
      r = r.filter(e => e.entry_date >= startDate && e.entry_date <= endDate)
    } else if (rangeDays > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - rangeDays)
      r = r.filter(e => e.entry_date >= cutoff.toISOString().slice(0, 10))
    }
    return r
  }, [allEntries, dept, rangeDays, startDate, endDate])

  const stats = useMemo(() => {
    const now = new Date()
    const month = filtered.filter(e => {
      const d = new Date(e.entry_date || '')
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return {
      total:      filtered.length,
      thisMonth:  month,
      highlights: filtered.filter(e => e.priority === 'Key highlight').length,
      depts:      new Set(filtered.map(e => e.dept)).size,
    }
  }, [filtered])

  const chartData = useMemo(() => {
    const groups: Record<string, number> = {}
    filtered.forEach(e => {
      const key = getGroupKey(e.entry_date, groupBy)
      groups[key] = (groups[key] || 0) + 1
    })
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ key, label: formatXLabel(key, groupBy), count }))
  }, [filtered, groupBy])

  const deptSummary = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(e => { map[e.dept] = (map[e.dept] || 0) + 1 })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }))
  }, [filtered])

  const recent   = useMemo(() => [...filtered].slice(0, 8), [filtered])
  const isCustom = !!(startDate || endDate)

  const periodLabel = isCustom
    ? `${startDate || '…'} → ${endDate || '…'}`
    : rangeDays === 0 ? 'all time' : `last ${rangeDays} days`

  function setQuickRange(days: number) {
    setRangeDays(days); setStartDate(''); setEndDate('')
  }

  return (
    <div className="animate-fade-in space-y-5">

      <div>
        <h1 className="text-2xl font-serif text-foreground">Knowledge Hub</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
        </p>
      </div>

      <div className="hub-card">
        <div className="flex items-center gap-1.5 mb-4">
          <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filters</span>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-44 shrink-0">
            <label className="hub-label">Department</label>
            <select className="hub-input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="shrink-0">
            <label className="hub-label">Period</label>
            <div className="flex gap-1 h-9 items-center">
              {QUICK_RANGES.map(r => (
                <button key={r.label} onClick={() => setQuickRange(r.days)}
                  className={`h-full px-3 rounded-lg text-xs font-medium border transition-colors ${
                    rangeDays === r.days && !isCustom
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-36 shrink-0">
            <label className="hub-label">From</label>
            <input type="date" className="hub-input" value={startDate}
              onChange={e => { setStartDate(e.target.value); setRangeDays(0) }} />
          </div>
          <div className="w-36 shrink-0">
            <label className="hub-label">To</label>
            <input type="date" className="hub-input" value={endDate}
              onChange={e => { setEndDate(e.target.value); setRangeDays(0) }} />
          </div>
          {isCustom && (
            <button onClick={() => { setStartDate(''); setEndDate(''); setRangeDays(30) }}
              className="h-9 px-3 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total entries',  value: stats.total },
          { label: 'This month',     value: stats.thisMonth },
          { label: 'Key highlights', value: stats.highlights },
          { label: 'Departments',    value: stats.depts },
        ].map(s => (
          <div key={s.label} className="hub-card flex items-center gap-3 py-3">
            <div className="text-2xl font-serif text-primary leading-none">{s.value}</div>
            <div className="text-xs text-muted-foreground leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="hub-card lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Entries over time</h2>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['daily', 'weekly', 'monthly'] as GroupBy[]).map(g => (
                  <button key={g} onClick={() => setGroupBy(g)}
                    className={`px-3 py-1 text-xs font-medium transition-colors capitalize ${
                      groupBy === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}>
                    {g}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{periodLabel}</span>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-[200px]">
              <p className="text-sm text-muted-foreground">No entries for the selected period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: 'hsl(var(--accent))' }}
                  formatter={(v: number) => [v, 'Entries']}
                  labelFormatter={(_, payload) => payload?.[0] ? formatTooltipLabel(payload[0].payload.key, groupBy) : ''}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="hub-card flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">By department</h2>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} entries</span>
          </div>
          {deptSummary.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No data.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1" style={{ maxHeight: 220 }}>
              {deptSummary.map(({ name, count }) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs mb-1 gap-2">
                    <span className="text-foreground truncate" title={name}>{name}</span>
                    <span className="text-muted-foreground font-semibold shrink-0">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60 transition-all duration-500"
                      style={{ width: `${(count / (deptSummary[0]?.count || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hub-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            Recent entries{dept && <span className="ml-2 font-normal text-muted-foreground">· {dept}</span>}
          </h2>
          <span className="text-xs text-muted-foreground">{filtered.length} total</span>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No entries for the selected filters.</p>
        ) : (
          <div>
            {recent.map(e => (
              <div key={e.id} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <span className="hub-badge bg-primary/10 text-primary">{e.dept}</span>
                    <span className="hub-badge bg-primary/5 text-primary/70">{e.type}</span>
                    {e.priority !== 'Normal' && (
                      <span className="hub-badge bg-primary text-primary-foreground">{e.priority}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{e.entry_date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
