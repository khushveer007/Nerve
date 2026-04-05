import { useEffect } from 'react'
import { SendHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import type { AssistantMode } from '../types'

interface AssistantComposerProps {
  mode: AssistantMode
  onChange: (value: string) => void
  onSubmit: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
  value: string
}

const MIN_HEIGHT = 72
const MAX_HEIGHT = 184

export default function AssistantComposer({
  mode,
  onChange,
  onSubmit,
  textareaRef,
  value,
}: AssistantComposerProps) {
  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    textarea.style.height = '0px'
    const nextHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, textarea.scrollHeight))
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [textareaRef, value])

  const canSubmit = value.trim().length > 0

  return (
    <div className="sticky bottom-0 z-10 -mx-2 mt-2 border-t border-border/70 bg-background/95 px-2 pb-2 pt-4 backdrop-blur">
      <div className="rounded-3xl border border-border bg-card p-3 shadow-sm">
        <div className="flex items-end gap-3">
          <Textarea
            aria-label="Message assistant"
            className="min-h-[72px] max-h-[184px] resize-none rounded-2xl border-0 bg-muted/35 px-4 py-3 text-sm leading-6 shadow-none focus-visible:ring-1"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSubmit()
              }
            }}
            placeholder="Ask a trusted question about Nerve knowledge..."
            ref={textareaRef}
            rows={2}
            value={value}
          />

          <Button
            aria-label="Send message"
            className="h-11 w-11 shrink-0 rounded-2xl"
            disabled={!canSubmit}
            onClick={onSubmit}
            size="icon"
            type="button"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Enter to send. Shift+Enter for a new line.
          </span>
          <span>Current mode: {mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
        </div>
      </div>
    </div>
  )
}
