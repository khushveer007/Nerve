import { useMemo } from 'react'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { useAssistantSourcePreviewQuery } from '../hooks/useAssistantQuery'
import type { AssistantSourceReference } from '../types'

function readAssistantSourceFromParams(searchParams: URLSearchParams): AssistantSourceReference | null {
  const assetId = searchParams.get('assistantAssetId')
  const assetVersionId = searchParams.get('assistantAssetVersionId')
  const chunkId = searchParams.get('assistantChunkId')
  const entryId = searchParams.get('assistantEntryId')
  const sourceKind = searchParams.get('assistantSourceKind')

  if (!assetId || !assetVersionId || !chunkId || !entryId || sourceKind !== 'entry') {
    return null
  }

  return {
    asset_id: assetId,
    asset_version_id: assetVersionId,
    chunk_id: chunkId,
    entry_id: entryId,
    source_kind: 'entry',
  }
}

export default function AssistantSourcePage() {
  const [searchParams] = useSearchParams()
  const source = useMemo(() => readAssistantSourceFromParams(searchParams), [searchParams])
  const previewQuery = useAssistantSourcePreviewQuery(source)

  if (!source) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Source link is incomplete</CardTitle>
            <CardDescription>
              Re-open this result from the assistant transcript to load a permission-safe source view.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild type="button" variant="outline">
              <Link to="/ai/query">
                <ArrowLeft className="h-4 w-4" />
                Back to Assistant
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (previewQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Opening source detail</CardTitle>
            <CardDescription>
              The assistant is verifying access and loading the entry-backed source view.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (previewQuery.isError || !previewQuery.data) {
    const description = previewQuery.error instanceof Error
      ? previewQuery.error.message
      : 'The assistant could not open that source.'

    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle>Source unavailable</CardTitle>
            </div>
            <CardDescription className="text-destructive/80">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild type="button" variant="outline">
              <Link to="/ai/query">
                <ArrowLeft className="h-4 w-4" />
                Back to Assistant
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { preview } = previewQuery.data

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild type="button" variant="outline">
          <Link to="/ai/query">
            <ArrowLeft className="h-4 w-4" />
            Back to Assistant
          </Link>
        </Button>
        <Badge variant="outline">Permission-safe source detail</Badge>
        <Badge variant="secondary">{preview.metadata.dept}</Badge>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>{preview.title}</CardTitle>
          <CardDescription>
            This view only loads assistant-authorized source content for the selected result.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div className="rounded-2xl border border-border/70 bg-background/80 p-5">
            <p className="text-sm leading-7 text-foreground/90">{preview.excerpt}</p>
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
        </CardContent>
      </Card>
    </div>
  )
}
