import { ExternalLink, ShieldAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

import {
  buildCitationAccessibleLabel,
  buildLocatorDetails,
  buildAssistantSourceKey,
} from '../evidence'
import type {
  AssistantCitation,
  AssistantEvidenceSelection,
  AssistantMode,
  AssistantQueryFilters,
  AssistantSourcePreviewPayload,
} from '../types'
import AssistantFiltersPanel from './AssistantFiltersPanel'

interface AssistantContextPanelProps {
  filters?: AssistantQueryFilters
  mode: AssistantMode
  onFiltersChange?: ((filters: AssistantQueryFilters) => void) | undefined
  onClearFilters?: (() => void) | undefined
  section?: 'full' | 'filters' | 'evidence'
  transcriptCount: number
  evidence?: AssistantEvidenceSelection | null
  preview?: AssistantSourcePreviewPayload | null
  previewError?: {
    title: string
    description: string
  } | null
  previewLoading?: boolean
  onPreviewEvidence?: (() => void) | undefined
  onOpenSource?: (() => void) | undefined
  onSelectCitation?: ((citation: AssistantCitation) => void) | undefined
  openSourcePending?: boolean
}

function EvidenceSection({
  transcriptCount,
  evidence,
  preview,
  previewError,
  previewLoading,
  onPreviewEvidence,
  onOpenSource,
  onSelectCitation,
  openSourcePending,
}: {
  transcriptCount: number
  evidence?: AssistantEvidenceSelection | null
  preview?: AssistantSourcePreviewPayload | null
  previewError?: {
    title: string
    description: string
  } | null
  previewLoading?: boolean
  onPreviewEvidence?: (() => void) | undefined
  onOpenSource?: (() => void) | undefined
  onSelectCitation?: ((citation: AssistantCitation) => void) | undefined
  openSourcePending?: boolean
}) {
  if (!evidence) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Evidence</p>
          <p className="text-sm text-muted-foreground">
            Citation inspection stays inside the authenticated assistant boundary.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {transcriptCount === 0
            ? 'Start a question to reserve space for citation-backed evidence and source verification.'
            : 'Focus or select a citation chip to inspect the supporting snippet, locator, and source actions.'}
        </div>
      </div>
    )
  }

  const citationSourceKey = evidence.citation
    ? buildAssistantSourceKey(evidence.citation.source)
    : null
  const previewSourceKey = preview ? buildAssistantSourceKey(preview.source) : null
  const previewMatchesSelection = citationSourceKey === null
    ? previewSourceKey === buildAssistantSourceKey(evidence.source)
    : previewSourceKey === citationSourceKey

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{evidence.citation ? 'Selected citation' : 'Selected source'}</Badge>
          {evidence.citation && <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100" variant="outline">{evidence.citation.label}</Badge>}
          <Badge variant="secondary">Entry evidence</Badge>
        </div>
        <p className="text-sm font-semibold text-foreground">{evidence.title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{evidence.snippet}</p>
      </div>

      {evidence.relatedCitations.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Cited sources</p>
          <div className="flex flex-wrap gap-2">
            {evidence.relatedCitations.map((citation) => {
              const isActive = evidence.citation?.label === citation.label
              return (
                <Button
                  aria-label={buildCitationAccessibleLabel(citation)}
                  aria-pressed={isActive}
                  className={[
                    'min-h-11 min-w-11 rounded-full border px-3 py-2 text-left text-sm',
                    isActive
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                      : 'border-border/70 bg-background hover:bg-accent',
                  ].join(' ')}
                  key={`${citation.asset_id}-${citation.label}`}
                  onClick={() => onSelectCitation?.(citation)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <span className="font-semibold">{citation.label}</span>
                  {isActive && <span className="text-xs uppercase tracking-[0.14em]">Selected</span>}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Locator</p>
        <div className="flex flex-wrap gap-2">
          {buildLocatorDetails(evidence.citationLocator).map((detail) => (
            <Badge key={`${evidence.source.chunk_id}-${detail}`} variant="secondary">
              {detail}
            </Badge>
          ))}
        </div>
      </div>

      {evidence.metadata && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{evidence.metadata.dept}</Badge>
            <Badge variant="secondary">{evidence.metadata.type}</Badge>
            <Badge variant="secondary">{evidence.metadata.priority}</Badge>
            {evidence.metadata.academic_year && (
              <Badge variant="outline">{evidence.metadata.academic_year}</Badge>
            )}
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{evidence.metadata.entry_date}</p>
            {evidence.metadata.author_name && <p>{evidence.metadata.author_name}</p>}
            {evidence.metadata.collaborating_org && <p>{evidence.metadata.collaborating_org}</p>}
          </div>

          {evidence.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {evidence.metadata.tags.map((tag) => (
                <Badge key={`${evidence.source.chunk_id}-${tag}`} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {evidence.actions.preview.available && (
          <Button
            className="min-h-11 flex-1"
            disabled={!onPreviewEvidence || previewLoading}
            onClick={onPreviewEvidence}
            type="button"
            variant="outline"
          >
            {previewLoading ? 'Loading preview...' : 'Preview'}
          </Button>
        )}

        {evidence.actions.open_source.available && (
          <Button
            className="min-h-11 flex-1"
            disabled={!onOpenSource || openSourcePending}
            onClick={onOpenSource}
            type="button"
            variant="ghost"
          >
            <ExternalLink className="h-4 w-4" />
            {openSourcePending ? 'Opening source...' : 'Open source'}
          </Button>
        )}
      </div>

      {previewError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <span>{previewError.title}</span>
          </div>
          <p className="leading-6 text-muted-foreground">{previewError.description}</p>
        </div>
      )}

      {previewMatchesSelection && preview && (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/90 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Entry preview</Badge>
            <Badge variant="secondary">{preview.metadata.dept}</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{preview.excerpt}</p>
        </div>
      )}
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
  evidence = null,
  preview = null,
  previewError = null,
  previewLoading = false,
  onPreviewEvidence,
  onOpenSource,
  onSelectCitation,
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
            evidence={evidence}
            onOpenSource={onOpenSource}
            onPreviewEvidence={onPreviewEvidence}
            onSelectCitation={onSelectCitation}
            openSourcePending={openSourcePending}
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
