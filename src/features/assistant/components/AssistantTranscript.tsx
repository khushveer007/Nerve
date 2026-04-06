import { ExternalLink, FileSearch, SearchX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { AssistantEntryResult, AssistantMessage, AssistantMode } from '../types'

interface AssistantTranscriptProps {
  onEditQuery: (queryText: string, queryMode: AssistantMode) => void
  messages: AssistantMessage[]
  onOpenSource: (result: AssistantEntryResult) => void
  onPreviewSource: (result: AssistantEntryResult) => void
  onRetryQuery: (queryText: string, queryMode: AssistantMode) => void
  openSourcePendingId?: string | null
  previewSourcePendingId?: string | null
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCountLabel(count: number) {
  return `${count} matching entry-backed result${count === 1 ? '' : 's'}`
}

export default function AssistantTranscript({
  onEditQuery,
  messages,
  onOpenSource,
  onPreviewSource,
  onRetryQuery,
  openSourcePendingId = null,
  previewSourcePendingId = null,
}: AssistantTranscriptProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Current session</CardTitle>
        <p className="text-sm text-muted-foreground">
          New turns stay in this workspace until you start a new conversation.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {messages.map((message, index) => (
          <div
            className="rounded-2xl border border-border/70 bg-muted/30 p-4"
            key={message.id}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                className={message.role === 'assistant' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50' : 'bg-primary/10 text-primary hover:bg-primary/10'}
                variant="outline"
              >
                {message.mode.charAt(0).toUpperCase() + message.mode.slice(1)}
              </Badge>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {message.role === 'assistant' ? 'Assistant' : 'User'}
              </span>
              <span className="text-xs text-muted-foreground">{formatTimestamp(message.createdAt)}</span>
            </div>

            {message.role === 'user' && (
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
            )}

            {message.role === 'assistant' && message.error && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{message.error.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{message.error.description}</p>
              </div>
            )}

            {message.role === 'assistant' && message.result && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{formatCountLabel(message.result.results.length)}</Badge>
                    {message.mode === 'auto' && message.result.mode === 'ask' && (
                      <Badge variant="outline">Routed to Ask</Badge>
                    )}
                    <Badge variant="outline">
                      {message.result.grounded ? 'Grounded' : 'Search-first'}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {message.content}
                  </p>
                </div>

                {message.result.results.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2 text-foreground">
                      <SearchX className="h-4 w-4" />
                      <span className="font-medium">No accessible entry-backed matches</span>
                    </div>
                    <p className="leading-6">
                      Retry this query or refine it with a title phrase, department name, or known tag from an existing entry.
                    </p>
                    {message.result.follow_up_suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.result.follow_up_suggestions.map((suggestion) => (
                          <p className="leading-6" key={`${message.id}-${suggestion}`}>
                            {suggestion}
                          </p>
                        ))}
                      </div>
                    )}
                    {messages[index - 1]?.role === 'user' && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          onClick={() => onRetryQuery(messages[index - 1]!.content, messages[index - 1]!.mode)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Try again
                        </Button>
                        <Button
                          onClick={() => onEditQuery(messages[index - 1]!.content, messages[index - 1]!.mode)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Edit original query
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {message.result.results.map((result) => {
                      const previewAvailable = result.actions?.preview.available ?? true
                      const openSourceAvailable = result.actions?.open_source.available ?? true

                      return (
                      <div className="rounded-2xl border border-border/70 bg-background/90 p-4" key={result.chunk_id}>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Entry</Badge>
                          <Badge variant="secondary">{result.metadata.dept}</Badge>
                          <Badge variant="secondary">{result.metadata.type}</Badge>
                          <Badge variant="secondary">{result.metadata.priority}</Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                              <FileSearch className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">{result.title}</p>
                              <p className="text-sm leading-6 text-muted-foreground">{result.snippet}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{result.metadata.entry_date}</span>
                            {result.metadata.author_name && <span>{result.metadata.author_name}</span>}
                            {result.metadata.academic_year && <span>{result.metadata.academic_year}</span>}
                            {result.metadata.collaborating_org && <span>{result.metadata.collaborating_org}</span>}
                          </div>

                          {result.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {result.metadata.tags.map((tag) => (
                                <Badge key={`${result.chunk_id}-${tag}`} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {result.metadata.external_link && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="break-all">{result.metadata.external_link}</span>
                            </div>
                          )}

                          {(previewAvailable || openSourceAvailable) && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {previewAvailable && (
                                <Button
                                  disabled={previewSourcePendingId === result.chunk_id}
                                  onClick={() => onPreviewSource(result)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {previewSourcePendingId === result.chunk_id ? 'Loading preview...' : 'Preview'}
                                </Button>
                              )}

                              {openSourceAvailable && (
                                <Button
                                  disabled={openSourcePendingId === result.chunk_id}
                                  onClick={() => onOpenSource(result)}
                                  size="sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  {openSourcePendingId === result.chunk_id ? 'Opening source...' : 'Open source'}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
