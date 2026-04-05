import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { AssistantMessage } from '../types'

interface AssistantTranscriptProps {
  messages: AssistantMessage[]
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function AssistantTranscript({ messages }: AssistantTranscriptProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Current session</CardTitle>
        <p className="text-sm text-muted-foreground">
          New turns stay in this workspace until you start a new conversation.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {messages.map((message) => (
          <div
            className="rounded-2xl border border-border/70 bg-muted/30 p-4"
            key={message.id}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10" variant="outline">
                {message.mode.charAt(0).toUpperCase() + message.mode.slice(1)}
              </Badge>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">User</span>
              <span className="text-xs text-muted-foreground">{formatTimestamp(message.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
