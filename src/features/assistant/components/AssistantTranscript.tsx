import { useState } from 'react'

import { AlertCircle, ExternalLink, FileSearch, SearchX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { buildAssistantFilterChips } from '../filters'
import type {
  AssistantCitation,
  AssistantEntryResult,
  AssistantMessage,
  AssistantMode,
  AssistantQueryResult,
} from '../types'

interface AssistantTranscriptProps {
  onEditQuery: (queryText: string, queryMode: AssistantMode) => void
  messages: AssistantMessage[]
  onOpenSource: (result: AssistantEntryResult) => void
  onPreviewSource: (result: AssistantEntryResult) => void
  onRetryQuery: (queryText: string, queryMode: AssistantMode) => void
  openSourcePendingId?: string | null
  previewSourcePendingId?: string | null
}

interface AnswerBlock {
  text: string
  labels: string[]
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

function parseAnswerBlocks(answer: string): AnswerBlock[] {
  return answer
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const labels = Array.from(paragraph.matchAll(/\[(S\d+)\]/g)).map((match) => match[1])
      const text = paragraph.replace(/\s*\[(S\d+)\]/g, '').trim()

      return {
        text,
        labels,
      }
    })
    .filter((block) => block.text.length > 0)
}

function renderCitationBadge(citation: AssistantCitation) {
  return (
    <Badge
      aria-label={`Citation ${citation.label}: ${citation.title}`}
      key={`${citation.asset_id}-${citation.label}`}
      variant="outline"
    >
      {citation.label}
    </Badge>
  )
}

function renderResultCard(
  result: AssistantEntryResult,
  onPreviewSource: (result: AssistantEntryResult) => void,
  onOpenSource: (result: AssistantEntryResult) => void,
  previewSourcePendingId: string | null,
  openSourcePendingId: string | null,
) {
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
  )
}

function renderSuggestions(messageId: string, suggestions: string[]) {
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => (
        <p className="text-sm leading-6 text-muted-foreground" key={`${messageId}-${suggestion}`}>
          {suggestion}
        </p>
      ))}
    </div>
  )
}

function renderAskState(
  message: AssistantMessage,
  previousUserMessage: AssistantMessage | undefined,
  expanded: boolean,
  onRetryQuery: (queryText: string, queryMode: AssistantMode) => void,
  onEditQuery: (queryText: string, queryMode: AssistantMode) => void,
  onPreviewSource: (result: AssistantEntryResult) => void,
  onOpenSource: (result: AssistantEntryResult) => void,
  previewSourcePendingId: string | null,
  openSourcePendingId: string | null,
  onShowMore: () => void,
) {
  const result = message.result!

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{formatCountLabel(result.total_results)}</Badge>
          {message.mode === 'auto' && result.mode === 'ask' && (
            <Badge variant="outline">Routed to Ask</Badge>
          )}
          <Badge variant="outline">
            {result.grounded ? 'Grounded' : 'Ask'}
          </Badge>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {message.content}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/80 p-3">
        <Badge variant="outline">{result.total_results} entry-backed results</Badge>
        {buildAssistantFilterChips(result.applied_filters).length === 0 && (
          <Badge variant="secondary">Filters: None</Badge>
        )}
        {buildAssistantFilterChips(result.applied_filters).map((chip) => (
          <Badge key={`${message.id}-${chip.key}`} variant="secondary">
            {chip.label}
          </Badge>
        ))}
      </div>

      {result.grounded && result.answer ? (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100" variant="outline">
              Grounded answer
            </Badge>
            <Badge variant="outline">{result.citations.length} citation{result.citations.length === 1 ? '' : 's'}</Badge>
          </div>

          <div className="space-y-3">
            {parseAnswerBlocks(result.answer).map((block, index) => (
              <div className="space-y-2" key={`${message.id}-answer-${index}`}>
                <p className="text-sm leading-6 text-foreground">{block.text}</p>
                {block.labels.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {block.labels.map((label) => {
                      const citation = result.citations.find((item) => item.label === label)
                      return citation ? renderCitationBadge(citation) : null
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {renderSuggestions(message.id, result.follow_up_suggestions)}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
              {result.total_results === 0 ? <SearchX className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {result.total_results === 0
                  ? 'No accessible entry-backed matches'
                  : result.enough_evidence
                    ? 'Grounded answer unavailable'
                    : 'Evidence confidence is low'}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {result.total_results === 0
                  ? 'Retry this query or refine it with a title phrase, department name, or date range from an existing entry.'
                  : result.enough_evidence
                    ? 'The server found supporting sources, but grounded answer generation is temporarily unavailable.'
                    : 'I found related sources, but not enough consistent evidence in the sources available to you to answer confidently yet.'}
              </p>
              {renderSuggestions(message.id, result.follow_up_suggestions)}
            </div>
          </div>

          {previousUserMessage?.role === 'user' && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => onRetryQuery(previousUserMessage.content, previousUserMessage.mode)}
                size="sm"
                type="button"
                variant="outline"
              >
                Try again
              </Button>
              <Button
                onClick={() => onEditQuery(previousUserMessage.content, previousUserMessage.mode)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Edit original query
              </Button>
            </div>
          )}
        </div>
      )}

      {result.results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Supporting sources</p>
            {!result.grounded && (
              <Badge variant="outline">Review evidence</Badge>
            )}
          </div>

          {(expanded ? result.results : result.results.slice(0, 5)).map((resultItem) => (
            renderResultCard(
              resultItem,
              onPreviewSource,
              onOpenSource,
              previewSourcePendingId,
              openSourcePendingId,
            )
          ))}

          {result.results.length > 5 && !expanded && (
            <Button
              onClick={onShowMore}
              type="button"
              variant="outline"
            >
              Show more results
            </Button>
          )}
        </div>
      )}
    </div>
  )
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
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})

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
              message.result.mode === 'ask'
                ? renderAskState(
                    message,
                    messages[index - 1],
                    Boolean(expandedMessages[message.id]),
                    onRetryQuery,
                    onEditQuery,
                    onPreviewSource,
                    onOpenSource,
                    previewSourcePendingId,
                    openSourcePendingId,
                    () => {
                      setExpandedMessages((current) => ({
                        ...current,
                        [message.id]: true,
                      }))
                    },
                  )
                : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{formatCountLabel(message.result.total_results)}</Badge>
                          <Badge variant="outline">Search</Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {message.content}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/80 p-3">
                        <Badge variant="outline">{message.result.total_results} entry-backed results</Badge>
                        {buildAssistantFilterChips(message.result.applied_filters).length === 0 && (
                          <Badge variant="secondary">Filters: None</Badge>
                        )}
                        {buildAssistantFilterChips(message.result.applied_filters).map((chip) => (
                          <Badge key={`${message.id}-${chip.key}`} variant="secondary">
                            {chip.label}
                          </Badge>
                        ))}
                      </div>

                      {message.result.results.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                          <div className="mb-2 flex items-center gap-2 text-foreground">
                            <SearchX className="h-4 w-4" />
                            <span className="font-medium">No accessible entry-backed matches</span>
                          </div>
                          <p className="leading-6">
                            Retry this query or refine it with a title phrase, department name, or date range from an existing entry.
                          </p>
                          {renderSuggestions(message.id, message.result.follow_up_suggestions)}
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
                          {(expandedMessages[message.id] ? message.result.results : message.result.results.slice(0, 5)).map((result) => (
                            renderResultCard(
                              result,
                              onPreviewSource,
                              onOpenSource,
                              previewSourcePendingId,
                              openSourcePendingId,
                            )
                          ))}
                          {message.result.results.length > 5 && !expandedMessages[message.id] && (
                            <Button
                              onClick={() => {
                                setExpandedMessages((current) => ({
                                  ...current,
                                  [message.id]: true,
                                }))
                              }}
                              type="button"
                              variant="outline"
                            >
                              Show more results
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
