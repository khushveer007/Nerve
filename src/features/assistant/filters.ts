import type { AssistantQueryFilters } from './types'

export const DEFAULT_ASSISTANT_FILTERS: AssistantQueryFilters = {
  department: null,
  date_range: {
    start: null,
    end: null,
  },
  sort: 'relevance',
}

export function createAssistantFilters(): AssistantQueryFilters {
  return {
    ...DEFAULT_ASSISTANT_FILTERS,
    date_range: {
      ...DEFAULT_ASSISTANT_FILTERS.date_range,
    },
  }
}

export interface AssistantFilterChip {
  key: 'department' | 'date_range' | 'sort'
  label: string
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function buildDateRangeLabel(filters: AssistantQueryFilters) {
  const start = filters.date_range.start
  const end = filters.date_range.end

  if (start && end) {
    return `Date: ${formatDateLabel(start)} to ${formatDateLabel(end)}`
  }

  if (start) {
    return `Date: From ${formatDateLabel(start)}`
  }

  if (end) {
    return `Date: Until ${formatDateLabel(end)}`
  }

  return null
}

export function buildAssistantFilterChips(filters: AssistantQueryFilters): AssistantFilterChip[] {
  const chips: AssistantFilterChip[] = []

  if (filters.department) {
    chips.push({
      key: 'department',
      label: `Department: ${filters.department}`,
    })
  }

  const dateLabel = buildDateRangeLabel(filters)
  if (dateLabel) {
    chips.push({
      key: 'date_range',
      label: dateLabel,
    })
  }

  if (filters.sort !== 'relevance') {
    chips.push({
      key: 'sort',
      label: `Sort: ${filters.sort === 'newest' ? 'Newest' : 'Relevance'}`,
    })
  }

  return chips
}

export function countActiveAssistantFilters(filters: AssistantQueryFilters) {
  return buildAssistantFilterChips(filters).length
}
