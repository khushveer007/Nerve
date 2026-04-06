import { ExternalLink, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import type { AssistantMode, AssistantQueryFilters, AssistantSourcePreviewPayload } from '../types'
import AssistantFiltersPanel from './AssistantFiltersPanel'

interface AssistantContextPanelProps {
  filters?: AssistantQueryFilters
  mode: AssistantMode
  onFiltersChange?: ((filters: AssistantQueryFilters) => void) | undefined
  onClearFilters?: (() => void) | undefined
  section?: 'full' | 'filters' | 'evidence'
  transcriptCount: number
  preview?: AssistantSourcePreviewPayload | null
  previewError?: {
    title: string
    description: string
  } | null
  previewLoading?: boolean
  onOpenSource?: (() => void) | undefined
  openSourcePending?: boolean
}

function EvidenceSection({
  transcriptCount,
  preview,
  previewError,
  previewLoading,
  onOpenSource,
  openSourcePending,
}: {
  transcriptCount: number
  preview?: AssistantSourcePreviewPayload | null
  previewError?: {
    title: string
    description: string
  } | null
  previewLoading?: boolean
  onOpenSource?: (() => void) | undefined
  openSourcePending?: boolean
}) {
  if (previewError) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Evidence</p>
          <p className="text-sm text-muted-foreground">
            Source actions stay inside the authenticated assistant boundary.
          </p>
        </div>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span>{previewError.title}</span>
          </div>
          <p className="leading-6 text-muted-foreground">{previewError.description}</p>
        </div>
      </div>
    )
  }

  if (previewLoading) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Evidence</p>
          <p className="text-sm text-muted-foreground">
            Loading a permission-safe source preview for this result.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          The assistant is verifying access and preparing the entry preview.
        </div>
      </div>
    )
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Entry preview</Badge>
            <Badge variant="secondary">{preview.metadata.dept}</Badge>
          </div>
          <p className="text-sm font-semibold text-foreground">{preview.title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{preview.excerpt}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{preview.metadata.type}</Badge>
          <Badge variant="secondary">{preview.metadata.priority}</Badge>
          {preview.metadata.academic_year && (
            <Badge variant="outline">{preview.metadata.academic_year}</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{preview.metadata.entry_date}</p>
          {preview.metadata.author_name && <p>{preview.metadata.author_name}</p>}
          {preview.metadata.collaborating_org && <p>{preview.metadata.collaborating_org}</p>}
        </div>

        {preview.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {preview.metadata.tags.map((tag) => (
              <Badge key={`${preview.source.chunk_id}-${tag}`} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <Button
          className="w-full justify-center"
          disabled={!onOpenSource || openSourcePending}
          onClick={onOpenSource}
          type="button"
          variant="outline"
        >
          <ExternalLink className="h-4 w-4" />
          {openSourcePending ? 'Opening source...' : preview.open_target.label}
        </Button>
      </div>
    )
  }

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
          : 'Select Preview on a result card to inspect a permission-safe entry excerpt here.'}
      </div>
    </div>
  )
}

export default function AssistantContextPanel({
  filters,
  mode,
  onFiltersChange,
  onClearFilters,
  section = 'full',
  transcriptCount,
  preview = null,
  previewError = null,
  previewLoading = false,
  onOpenSource,
  openSourcePending = false,
}: AssistantContextPanelProps) {
  return (
    <Card className="h-full border-border/70">
      <CardHeader>
        <CardTitle className="text-lg">Workspace context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {(section === 'full' || section === 'filters') && filters && onFiltersChange && onClearFilters && (
          <AssistantFiltersPanel
            filters={filters}
            mode={mode}
            onChange={onFiltersChange}
            onClearAll={onClearFilters}
          />
        )}
        {section === 'full' && <Separator />}
        {(section === 'full' || section === 'evidence') && (
          <EvidenceSection
            openSourcePending={openSourcePending}
            onOpenSource={onOpenSource}
            preview={preview}
            previewError={previewError}
            previewLoading={previewLoading}
            transcriptCount={transcriptCount}
          />
        )}
      </CardContent>
    </Card>
  )
}
