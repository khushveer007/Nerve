import { useMemo, useRef, useState } from 'react'

import { FileSearch } from 'lucide-react'

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
import { useAssistantAvailability } from '../hooks/useAssistantAvailability'
import { useAssistantQuery } from '../hooks/useAssistantQuery'
import type {
  AssistantMessage,
  AssistantMode,
  AssistantQueryResult,
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

const EMPTY_FILTERS = {
  departments: [],
  entry_types: [],
  priorities: [],
  tags: [],
} as const

function buildAssistantSummary(result: AssistantQueryResult) {
  if (result.results.length === 0) {
    return 'No indexed entry-backed results matched this request yet.'
  }

  if (result.mode === 'ask') {
    return `Grounded answer synthesis is still reserved for a later story, but I found ${result.results.length} entry-backed result${result.results.length === 1 ? '' : 's'} for this request.`
  }

  return `I found ${result.results.length} entry-backed result${result.results.length === 1 ? '' : 's'} from the indexed Phase 1 corpus.`
}

export default function AssistantPage() {
  const [mode, setMode] = useState<AssistantMode>('auto')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [pendingConversationId, setPendingConversationId] = useState<number | null>(null)

  const conversationIdRef = useRef(0)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useIsMobile()
  const { availability, isChecking, showUnavailable } = useAssistantAvailability()
  const queryMutation = useAssistantQuery()

  const hasTranscript = messages.length > 0
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
  const isSubmitting = pendingConversationId === conversationIdRef.current

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
      return {
        kind: 'loading',
        stage: 'retrieving',
        title: 'Searching the indexed entry corpus.',
        description: 'The assistant is retrieving entry-backed matches from the Phase 1 knowledge layer.',
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

    if (lastAssistantMessage?.result && lastAssistantMessage.result.results.length === 0) {
      return {
        kind: 'no_answer',
        title: 'No indexed entry-backed matches were found.',
        description: 'Try a known title phrase, department name, or tag from an existing Nerve entry.',
      }
    }

    return { kind: 'result' }
  }, [availability, hasTranscript, isChecking, isSubmitting, lastAssistantMessage, showUnavailable])

  function focusComposer() {
    composerRef.current?.focus()
  }

  async function handleSubmit(nextPrompt?: string) {
    const content = (nextPrompt ?? draft).trim()

    if (!content || isChecking || isSubmitting) {
      return
    }

    const conversationId = conversationIdRef.current
    const createdAt = new Date().toISOString()
    const userMessage: AssistantMessage = {
      id: createMessageId(),
      role: 'user',
      content,
      mode,
      createdAt,
    }

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setPendingConversationId(conversationId)
    focusComposer()

    if (showUnavailable) {
      setPendingConversationId(null)
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: '',
          mode,
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
          mode,
          text: content,
          filters: EMPTY_FILTERS,
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
          content: buildAssistantSummary(result),
          mode,
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
          mode,
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
      }
    }
  }

  function handleNewConversation() {
    conversationIdRef.current += 1
    setPendingConversationId(null)
    queryMutation.reset()
    setMessages([])
    setDraft('')
    focusComposer()
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

      {(visibleState.kind === 'loading' || visibleState.kind === 'info' || visibleState.kind === 'unavailable') && (
        <AssistantStatusCard status={visibleState} />
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {hasTranscript ? (
            <AssistantTranscript messages={messages} />
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
          <AssistantContextPanel mode={mode} transcriptCount={messages.length} />
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
              <DrawerDescription>Filter and scope controls will connect here in the next story.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">
              <AssistantContextPanel mode={mode} section="filters" transcriptCount={messages.length} />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent className="w-full sm:max-w-lg" side="right">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Filter and scope controls will connect here in the next story.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <AssistantContextPanel mode={mode} section="filters" transcriptCount={messages.length} />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <Drawer open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Evidence</DrawerTitle>
            <DrawerDescription>
              This drawer reserves the mobile evidence surface for citations and supporting passages.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <AssistantContextPanel mode={mode} section="evidence" transcriptCount={messages.length} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
