import { useQuery } from '@tanstack/react-query'

import { assistantApi, assistantEnabled, getInitialAssistantAvailability } from '../api'

export function useAssistantAvailability() {
  const enabled = assistantEnabled()
  const initialAvailability = getInitialAssistantAvailability()

  const query = useQuery({
    queryKey: ['assistant', 'availability'],
    queryFn: assistantApi.getAvailability,
    enabled,
    initialData: enabled ? undefined : initialAvailability,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  const availability = query.data ?? initialAvailability
  const showUnavailable = !enabled || (!query.isFetching && query.isFetched && !availability.available)

  return {
    availability,
    isChecking: enabled && (query.isLoading || query.isFetching),
    showUnavailable,
  }
}
