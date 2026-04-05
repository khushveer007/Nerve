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
import type { AssistantMessage, AssistantMode, AssistantVisibleState } from '../types'
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

export default function AssistantPage() {
  const [mode, setMode] = useState<AssistantMode>('auto')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)

  const composerRef = useRef<HTMLTextAreaElement>(null)
  const isMobile = useIsMobile()
  const { availability, showUnavailable } = useAssistantAvailability()

  const hasTranscript = messages.length > 0

  const visibleState: AssistantVisibleState = useMemo(() => {
    if (showUnavailable) {
      return {
        kind: 'unavailable',
        title: availability.title,
        description: availability.description,
        nextStep: availability.nextStep,
      }
    }

    if (!hasTranscript) {
      return { kind: 'empty' }
    }

    return { kind: 'result' }
  }, [availability, hasTranscript, showUnavailable])

  function focusComposer() {
    composerRef.current?.focus()
  }

  function handleSubmit(nextPrompt?: string) {
    const content = (nextPrompt ?? draft).trim()

    if (!content) {
      return
    }

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: 'user',
        content,
        mode,
        createdAt: new Date().toISOString(),
      },
    ])
    setDraft('')
    focusComposer()
  }

  function handleNewConversation() {
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

      {visibleState.kind === 'unavailable' && <AssistantStatusCard status={visibleState} />}

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
        mode={mode}
        onChange={setDraft}
        onSubmit={() => handleSubmit()}
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
