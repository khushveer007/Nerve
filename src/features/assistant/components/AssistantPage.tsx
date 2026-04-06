import { useMemo, useRef, useState } from 'react'

import { FileSearch, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

import { ASSISTANT_STARTER_PROMPTS, getAssistantAnnouncement } from '../constants'
import {
  buildAssistantFilterChips,
  countActiveAssistantFilters,
  createAssistantFilters,
} from '../filters'
import { useAssistantAvailability } from '../hooks/useAssistantAvailability'
import {
  useAssistantQuery,
  useAssistantSourceOpen,
  useAssistantSourcePreview,
} from '../hooks/useAssistantQuery'
import type {
  AssistantEntryResult,
  AssistantMessage,
  AssistantMode,
  AssistantQueryFilters,
  AssistantQueryResult,
  AssistantSourceReference,
  AssistantSourcePreviewPayload,
  AssistantVisibleState,
} from '../types'
import AssistantComposer from './AssistantComposer'
import AssistantContextPanel from './AssistantContextPanel'
import AssistantEmptyState from './AssistantEmptyState'
import AssistantHeader from './AssistantHeader'
import AssistantModeToggle from './AssistantModeToggle'
import AssistantStatusAnnouncer from './AssistantStatusAnnouncer'
import AssistantStatusCard from './AssistantStatusCard'
import AssistantTranscript from './AssistantTranscript'

function createMessageId() {
  return `assistant-turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildAssistantSummary(result: AssistantQueryResult, requestedMode: AssistantMode) {
  const autoAskPrefix = requestedMode === 'auto' && result.mode === 'ask'
    ? 'Auto mode routed this turn through Ask. '
    : ''

  if (result.mode === 'ask' && result.grounded && result.answer) {
    return `${autoAskPrefix}Answer based on ${result.citations.length} cited source${result.citations.length === 1 ? '' : 's'}.`
  }

  if (result.mode === 'ask' && !result.enough_evidence && result.total_results > 0) {
    return `${autoAskPrefix}I found related entry evidence, but not enough consistent support in the sources available to answer confidently.`
  }

  if (result.total_results === 0) {
    return `${autoAskPrefix}No accessible entry-backed matches were found for this request.`
  }

  if (result.mode === 'ask') {
    return `${autoAskPrefix}I found supporting entry evidence, but I am holding the response to what the server could ground safely.`
  }

  return `I found ${result.total_results} entry-backed result${result.total_results === 1 ? '' : 's'} from the indexed Phase 1 corpus.`
}

function clearAssistantFilterKey(filters: AssistantQueryFilters, key: 'department' | 'date_range' | 'sort') {
  if (key === 'department') {
    return {
      ...filters,
      department: null,
    }
  }

  if (key === 'date_range') {
    return {
      ...filters,
      date_range: {
        start: null,
        end: null,
      },
    }
  }

  return {
    ...filters,
    sort: 'relevance',
  }
}

export default function AssistantPage() {
  const [mode, setMode] = useState<AssistantMode>('auto')
  const [draft, setDraft] = useState('')
  const [filters, setFilters] = useState<AssistantQueryFilters>(() => createAssistantFilters())
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [pendingConversationId, setPendingConversationId] = useState<number | null>(null)
  const [pendingMode, setPendingMode] = useState<AssistantMode | null>(null)
  const [selectedPreview, setSelectedPreview] = useState<AssistantEntryResult | null>(null)
  const [selectedPreviewPayload, setSelectedPreviewPayload] = useState<AssistantSourcePreviewPayload | null>(null)
  const [sourceActionError, setSourceActionError] = useState<null | {
    title: string
    description: string
  }>(null)

  const conversationIdRef = useRef(0)
  const sourceActionScopeRef = useRef(0)
  const previewRequestIdRef = useRef(0)
  const openRequestIdRef = useRef(0)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useIsMobile()
  const { availability, isChecking, showUnavailable } = useAssistantAvailability()
  const queryMutation = useAssistantQuery()
  const previewMutation = useAssistantSourcePreview()
  const openMutation = useAssistantSourceOpen()

  const hasTranscript = messages.length > 0
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
  const isSubmitting = pendingConversationId === conversationIdRef.current
  const activeFilterChips = buildAssistantFilterChips(filters)
  const activeFilterCount = countActiveAssistantFilters(filters)

  const visibleState: AssistantVisibleState = useMemo(() => {
    if (showUnavailable) {
      return {
        kind: 'unavailable',
        title: availability.title,
        description: availability.description,
        nextStep: availability.nextStep,
      }
    }

    if (isChecking) {
      return {
        kind: 'loading',
        stage: 'checking',
        title: 'Checking assistant availability.',
        description: 'The workspace is confirming whether the backend entry search service is ready for queries.',
      }
    }

    if (isSubmitting) {
      const isAskGeneration = pendingMode === 'ask'

      return {
        kind: 'loading',
        stage: isAskGeneration ? 'generating' : 'retrieving',
        title: pendingMode === 'auto'
          ? 'Routing the question and gathering evidence.'
          : isAskGeneration
            ? 'Generating a grounded answer.'
            : 'Searching the indexed entry corpus.',
        description: pendingMode === 'auto'
          ? 'The assistant is choosing the right search or answer path and checking the matching entry evidence.'
          : isAskGeneration
            ? 'The assistant is checking evidence sufficiency and composing a citation-backed answer.'
            : 'The assistant is retrieving entry-backed matches from the Phase 1 knowledge layer.',
      }
    }

    if (!hasTranscript && availability.available && availability.source === 'service') {
      return {
        kind: 'info',
        title: availability.title,
        description: availability.description,
        nextStep: availability.nextStep,
      }
    }

    if (!hasTranscript) {
      return { kind: 'empty' }
    }

    if (lastAssistantMessage?.error) {
      return {
        kind: 'error',
        title: lastAssistantMessage.error.title,
        description: lastAssistantMessage.error.description,
      }
    }

    if (
      lastAssistantMessage?.result
      && lastAssistantMessage.result.mode === 'ask'
      && !lastAssistantMessage.result.grounded
      && !lastAssistantMessage.result.enough_evidence
    ) {
      return {
        kind: 'no_answer',
        title: lastAssistantMessage.result.results.length === 0
          ? 'No accessible entry-backed matches were found.'
          : 'Not enough consistent evidence was found.',
        description: lastAssistantMessage.result.results.length === 0
          ? 'Retry the same query or refine it with a title phrase, department name, or date range.'
          : 'The assistant found related sources, but not enough consistent evidence in the sources available to answer confidently.',
      }
    }

    if (lastAssistantMessage?.result && lastAssistantMessage.result.results.length === 0) {
      return {
        kind: 'no_answer',
        title: 'No accessible entry-backed matches were found.',
        description: 'Retry the same query or refine it with a title phrase, department name, or date range.',
      }
    }

    return { kind: 'result' }
  }, [availability, hasTranscript, isChecking, isSubmitting, lastAssistantMessage, pendingMode, showUnavailable])

  function focusComposer() {
    composerRef.current?.focus()
  }

  function invalidateSourceActions() {
    sourceActionScopeRef.current += 1
    setSelectedPreview(null)
    setSelectedPreviewPayload(null)
    setSourceActionError(null)
  }

  function buildSourceReference(result: AssistantEntryResult): AssistantSourceReference {
    return {
      asset_id: result.asset_id,
      asset_version_id: result.asset_version_id,
      chunk_id: result.chunk_id,
      entry_id: result.entry_id,
      source_kind: 'entry',
    }
  }

  async function handlePreviewSource(result: AssistantEntryResult) {
    const sourceActionScope = sourceActionScopeRef.current
    const requestId = ++previewRequestIdRef.current
    setSourceActionError(null)

    try {
      const payload = await previewMutation.mutateAsync({
        preview: {
          source: buildSourceReference(result),
        },
      })

      if (
        sourceActionScope !== sourceActionScopeRef.current
        || requestId !== previewRequestIdRef.current
      ) {
        return
      }

      setSelectedPreview(result)
      setSelectedPreviewPayload(payload.preview)
      setEvidenceOpen(true)
    } catch (error) {
      if (
        sourceActionScope !== sourceActionScopeRef.current
        || requestId !== previewRequestIdRef.current
      ) {
        return
      }

      setSelectedPreview(null)
      setSelectedPreviewPayload(null)
      setEvidenceOpen(true)
      setSourceActionError({
        title: 'Source preview unavailable.',
        description: error instanceof Error
          ? error.message
          : 'The assistant could not open that source preview.',
      })
    }
  }

  async function handleOpenSource(result: AssistantEntryResult) {
    const sourceActionScope = sourceActionScopeRef.current
    const requestId = ++openRequestIdRef.current
    setSourceActionError(null)

    try {
      const payload = await openMutation.mutateAsync({
        open: {
          source: buildSourceReference(result),
        },
      })

      if (
        sourceActionScope !== sourceActionScopeRef.current
        || requestId !== openRequestIdRef.current
      ) {
        return
      }

      window.location.assign(payload.open.target.path)
    } catch (error) {
      if (
        sourceActionScope !== sourceActionScopeRef.current
        || requestId !== openRequestIdRef.current
      ) {
        return
      }

      setEvidenceOpen(true)
      setSourceActionError({
        title: 'Source open unavailable.',
        description: error instanceof Error
          ? error.message
          : 'The assistant could not open that source.',
      })
    }
  }

  function handleEditOriginalQuery(queryText: string, queryMode: AssistantMode) {
    setMode(queryMode)
    setDraft(queryText)
    focusComposer()
  }

  async function handleSubmit(nextPrompt?: string, requestedMode?: AssistantMode) {
    const content = (nextPrompt ?? draft).trim()
    const effectiveMode = requestedMode ?? mode

    if (!content || isChecking || isSubmitting) {
      return
    }

    const conversationId = conversationIdRef.current
    const createdAt = new Date().toISOString()
    const userMessage: AssistantMessage = {
      id: createMessageId(),
      role: 'user',
      content,
      mode: effectiveMode,
      createdAt,
    }

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setPendingConversationId(conversationId)
    setPendingMode(effectiveMode)
    invalidateSourceActions()
    focusComposer()

    if (showUnavailable) {
      setPendingConversationId(null)
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: '',
          mode: effectiveMode,
          createdAt: new Date().toISOString(),
          error: {
            title: availability.title,
            description: availability.description,
          },
        },
      ])
      return
    }

    try {
      const result = await queryMutation.mutateAsync({
        query: {
          mode: effectiveMode,
          text: content,
          filters,
        },
      })

      if (conversationIdRef.current !== conversationId) {
        return
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: buildAssistantSummary(result, effectiveMode),
          mode: effectiveMode,
          createdAt: new Date().toISOString(),
          result,
        },
      ])
    } catch (error) {
      if (conversationIdRef.current !== conversationId) {
        return
      }

      const description = error instanceof Error
        ? error.message
        : 'The assistant request could not be completed.'

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: '',
          mode: effectiveMode,
          createdAt: new Date().toISOString(),
          error: {
            title: 'Assistant request failed.',
            description,
          },
        },
      ])
    } finally {
      if (conversationIdRef.current === conversationId) {
        setPendingConversationId(null)
        setPendingMode(null)
      }
    }
  }

  function handleNewConversation() {
    conversationIdRef.current += 1
    setPendingConversationId(null)
    setPendingMode(null)
    invalidateSourceActions()
    queryMutation.reset()
    previewMutation.reset()
    openMutation.reset()
    setMessages([])
    setDraft('')
    focusComposer()
  }

  function handleClearAllFilters() {
    setFilters(createAssistantFilters())
  }

  const announcement = getAssistantAnnouncement(visibleState)

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      <AssistantStatusAnnouncer message={announcement} />

      <AssistantHeader
        onNewConversation={handleNewConversation}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <AssistantModeToggle mode={mode} onModeChange={setMode} />

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-muted/30 p-3">
          <Badge variant="outline">Active filters</Badge>
          {activeFilterChips.map((chip) => (
            <Button
              aria-label={`Remove ${chip.label}`}
              key={chip.key}
              onClick={() => setFilters((current) => clearAssistantFilterKey(current, chip.key))}
              size="sm"
              type="button"
              variant="outline"
            >
              {chip.label}
              <X className="h-3.5 w-3.5" />
            </Button>
          ))}
          <Button
            onClick={handleClearAllFilters}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear all filters
          </Button>
        </div>
      )}

      {(visibleState.kind === 'loading' || visibleState.kind === 'info' || visibleState.kind === 'unavailable') && (
        <AssistantStatusCard status={visibleState} />
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {hasTranscript ? (
            <AssistantTranscript
              messages={messages}
              onEditQuery={handleEditOriginalQuery}
              onOpenSource={(result) => {
                void handleOpenSource(result)
              }}
              onPreviewSource={(result) => {
                void handlePreviewSource(result)
              }}
              onRetryQuery={(queryText, queryMode) => {
                void handleSubmit(queryText, queryMode)
              }}
              openSourcePendingId={openMutation.isPending ? (openMutation.variables?.open.source.chunk_id ?? null) : null}
              previewSourcePendingId={previewMutation.isPending ? (previewMutation.variables?.preview.source.chunk_id ?? null) : null}
            />
          ) : (
            <AssistantEmptyState prompts={ASSISTANT_STARTER_PROMPTS} onPromptSelect={handleSubmit} />
          )}

          <Card className="border-border/70 lg:hidden">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                  <FileSearch className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Evidence surface reserved</p>
                  <p className="text-sm text-muted-foreground">
                    Open the evidence drawer to review where citations and supporting passages will appear.
                  </p>
                </div>
              </div>

              <Button className="h-11 sm:min-w-[10rem]" onClick={() => setEvidenceOpen(true)} type="button" variant="outline">
                View evidence
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="hidden lg:block">
          <AssistantContextPanel
            filters={filters}
            mode={mode}
            onClearFilters={handleClearAllFilters}
            onFiltersChange={setFilters}
            onOpenSource={selectedPreview ? () => {
              void handleOpenSource(selectedPreview)
            } : undefined}
            openSourcePending={openMutation.isPending}
            preview={selectedPreviewPayload}
            previewError={sourceActionError}
            previewLoading={previewMutation.isPending}
            transcriptCount={messages.length}
          />
        </div>
      </div>

      <AssistantComposer
        disabled={isChecking || isSubmitting}
        mode={mode}
        onChange={setDraft}
        onSubmit={() => {
          void handleSubmit()
        }}
        textareaRef={composerRef}
        value={draft}
      />

      {isMobile ? (
        <Drawer open={filtersOpen} onOpenChange={setFiltersOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerDescription>Apply Phase 1 department, date, and sort filters for this assistant session.</DrawerDescription>
            </DrawerHeader>
          <div className="px-4 pb-6">
            <AssistantContextPanel
              filters={filters}
              mode={mode}
              onClearFilters={handleClearAllFilters}
              onFiltersChange={setFilters}
              section="filters"
              transcriptCount={messages.length}
            />
          </div>
        </DrawerContent>
      </Drawer>
      ) : (
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent className="w-full sm:max-w-lg" side="right">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Apply Phase 1 department, date, and sort filters for this assistant session.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <AssistantContextPanel
                filters={filters}
                mode={mode}
                onClearFilters={handleClearAllFilters}
                onFiltersChange={setFilters}
                section="filters"
                transcriptCount={messages.length}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <Drawer open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Evidence</DrawerTitle>
            <DrawerDescription>
              This drawer shows permission-safe supporting source previews for assistant results.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <AssistantContextPanel
              filters={filters}
              mode={mode}
              onClearFilters={handleClearAllFilters}
              onFiltersChange={setFilters}
              onOpenSource={selectedPreview ? () => {
                void handleOpenSource(selectedPreview)
              } : undefined}
              openSourcePending={openMutation.isPending}
              preview={selectedPreviewPayload}
              previewError={sourceActionError}
              previewLoading={previewMutation.isPending}
              section="evidence"
              transcriptCount={messages.length}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
