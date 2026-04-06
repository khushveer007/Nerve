import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEPARTMENTS } from '@/lib/constants'

import { countActiveAssistantFilters } from '../filters'
import type { AssistantMode, AssistantQueryFilters } from '../types'

interface AssistantFiltersPanelProps {
  filters: AssistantQueryFilters
  mode: AssistantMode
  onChange: (filters: AssistantQueryFilters) => void
  onClearAll: () => void
}

export default function AssistantFiltersPanel({
  filters,
  mode,
  onChange,
  onClearAll,
}: AssistantFiltersPanelProps) {
  const activeFilterCount = countActiveAssistantFilters(filters)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Phase 1 filters</p>
          <p className="text-sm text-muted-foreground">
            Filters stay active across turns until you remove a chip or clear them here.
          </p>
        </div>
        <Badge variant="outline">{mode}</Badge>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="assistant-filter-department">Department</Label>
          <select
            aria-label="Department"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            id="assistant-filter-department"
            onChange={(event) => {
              onChange({
                ...filters,
                department: event.target.value || null,
              })
            }}
            value={filters.department ?? ''}
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="assistant-filter-start-date">From date</Label>
            <Input
              aria-label="From date"
              id="assistant-filter-start-date"
              onChange={(event) => {
                onChange({
                  ...filters,
                  date_range: {
                    ...filters.date_range,
                    start: event.target.value || null,
                  },
                })
              }}
              type="date"
              value={filters.date_range.start ?? ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistant-filter-end-date">To date</Label>
            <Input
              aria-label="To date"
              id="assistant-filter-end-date"
              onChange={(event) => {
                onChange({
                  ...filters,
                  date_range: {
                    ...filters.date_range,
                    end: event.target.value || null,
                  },
                })
              }}
              type="date"
              value={filters.date_range.end ?? ''}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assistant-filter-sort">Sort</Label>
          <select
            aria-label="Sort"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            id="assistant-filter-sort"
            onChange={(event) => {
              onChange({
                ...filters,
                sort: event.target.value as AssistantQueryFilters['sort'],
              })
            }}
            value={filters.sort}
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        <span>{activeFilterCount === 0 ? 'No active filters.' : `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}.`}</span>
        <Button
          disabled={activeFilterCount === 0}
          onClick={onClearAll}
          size="sm"
          type="button"
          variant="outline"
        >
          Clear all
        </Button>
      </div>
    </div>
  )
}
