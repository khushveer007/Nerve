import { AlertTriangle, Info, LoaderCircle, SearchX, WifiOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

import type { AssistantVisibleState } from '../types'

type SupportedStatus =
  | Extract<AssistantVisibleState, { kind: 'loading' }>
  | Extract<AssistantVisibleState, { kind: 'info' }>
  | Extract<AssistantVisibleState, { kind: 'no_answer' }>
  | Extract<AssistantVisibleState, { kind: 'error' }>
  | Extract<AssistantVisibleState, { kind: 'unavailable' }>

interface AssistantStatusCardProps {
  status: SupportedStatus
}

export default function AssistantStatusCard({ status }: AssistantStatusCardProps) {
  const iconMap = {
    loading: LoaderCircle,
    info: Info,
    no_answer: SearchX,
    error: AlertTriangle,
    unavailable: WifiOff,
  } as const

  const badgeMap = {
    loading: 'In progress',
    info: 'Connected',
    no_answer: 'No answer',
    error: 'Error',
    unavailable: 'Unavailable',
  } as const

  const cardClassName = status.kind === 'info'
    ? 'w-full border-emerald-200/70 bg-emerald-50/70'
    : 'w-full border-amber-200/70 bg-amber-50/70'

  const iconClassName = status.kind === 'info'
    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background text-emerald-700'
    : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background text-amber-700'

  const Icon = iconMap[status.kind]

  return (
    <Card className={cardClassName}>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className={iconClassName}>
          <Icon className={`h-5 w-5 ${status.kind === 'loading' ? 'animate-spin' : ''}`} />
        </div>

        <div className="space-y-3">
          <Badge className="bg-background text-foreground" variant="outline">
            {badgeMap[status.kind]}
          </Badge>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{status.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">{status.description}</p>
            {'nextStep' in status && (
              <p className="text-sm leading-6 text-muted-foreground">{status.nextStep}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
