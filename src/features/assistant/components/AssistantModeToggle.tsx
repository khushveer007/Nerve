import { Button } from '@/components/ui/button'

import { ASSISTANT_MODE_OPTIONS } from '../constants'
import type { AssistantMode } from '../types'

interface AssistantModeToggleProps {
  mode: AssistantMode
  onModeChange: (mode: AssistantMode) => void
}

export default function AssistantModeToggle({ mode, onModeChange }: AssistantModeToggleProps) {
  const activeMode =
    ASSISTANT_MODE_OPTIONS.find((option) => option.value === mode) ?? ASSISTANT_MODE_OPTIONS[0]

  return (
    <div className="space-y-2">
      <div aria-label="Assistant mode" className="flex w-full flex-wrap justify-start gap-2" role="group">
        {ASSISTANT_MODE_OPTIONS.map((option) => (
          <Button
            aria-pressed={mode === option.value}
            className="h-11 rounded-full border border-border px-4 text-sm"
            key={option.value}
            onClick={() => onModeChange(option.value)}
            type="button"
            variant={mode === option.value ? 'default' : 'outline'}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{activeMode.description}</p>
    </div>
  )
}
