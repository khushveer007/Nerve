import { RotateCcw, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface AssistantHeaderProps {
  onNewConversation: () => void
  onOpenFilters: () => void
}

export default function AssistantHeader({
  onNewConversation,
  onOpenFilters,
}: AssistantHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-serif text-foreground">Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Search and answer across Nerve knowledge with citations.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-11 min-w-[11rem]"
          onClick={onNewConversation}
          type="button"
          variant="outline"
        >
          <RotateCcw className="w-4 h-4" />
          New conversation
        </Button>
        <Button className="h-11 min-w-[8rem]" onClick={onOpenFilters} type="button" variant="outline">
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </Button>
      </div>
    </div>
  )
}
