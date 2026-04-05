import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import type { AssistantMode } from '../types'

interface AssistantContextPanelProps {
  mode: AssistantMode
  section?: 'full' | 'filters' | 'evidence'
  transcriptCount: number
}

function FiltersSection({ mode }: { mode: AssistantMode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Filters</p>
          <p className="text-sm text-muted-foreground">
            Retrieval filters will narrow results in the next story.
          </p>
        </div>
        <Badge variant="outline">{mode}</Badge>
      </div>

      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Filter chips, departments, and scoped evidence controls are reserved here so later stories can
        connect them without redesigning the shell.
      </div>
    </div>
  )
}

function EvidenceSection({ transcriptCount }: { transcriptCount: number }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Evidence</p>
        <p className="text-sm text-muted-foreground">
          Citations and supporting passages will appear in this surface once retrieval is connected.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {transcriptCount === 0
          ? 'Start a question to reserve space for supporting sources and response context.'
          : 'Your conversation has started. Supporting sources will appear here when the assistant backend is available.'}
      </div>
    </div>
  )
}

export default function AssistantContextPanel({
  mode,
  section = 'full',
  transcriptCount,
}: AssistantContextPanelProps) {
  return (
    <Card className="h-full border-border/70">
      <CardHeader>
        <CardTitle className="text-lg">Workspace context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {(section === 'full' || section === 'filters') && <FiltersSection mode={mode} />}
        {section === 'full' && <Separator />}
        {(section === 'full' || section === 'evidence') && (
          <EvidenceSection transcriptCount={transcriptCount} />
        )}
      </CardContent>
    </Card>
  )
}
