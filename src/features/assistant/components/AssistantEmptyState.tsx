import { ShieldCheck } from 'lucide-react'

interface AssistantPrompt {
  id: string
  label: string
  prompt: string
}

interface AssistantEmptyStateProps {
  prompts: readonly AssistantPrompt[]
  onPromptSelect: (prompt: string) => void
}

export default function AssistantEmptyState({ prompts, onPromptSelect }: AssistantEmptyStateProps) {
  return (
    <section className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground">
            Trusted answers start with verified retrieval.
          </p>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Ask for highlights, proof points, or a focused brief. This workspace keeps the session inside
            Nerve and is ready for grounded search, answer, and citation flows as the backend comes online.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {prompts.map((prompt) => (
          <button
            aria-label={`Assistant starter prompt: ${prompt.label}`}
            className="min-h-11 rounded-full border border-border bg-background px-4 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
            key={prompt.id}
            onClick={() => onPromptSelect(prompt.prompt)}
            type="button"
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </section>
  )
}
