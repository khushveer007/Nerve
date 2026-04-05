import { useEffect, useState } from 'react'

interface AssistantStatusAnnouncerProps {
  message: string
}

export default function AssistantStatusAnnouncer({ message }: AssistantStatusAnnouncerProps) {
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (message !== announcement) {
      setAnnouncement(message)
    }
  }, [announcement, message])

  return (
    <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
      {announcement}
    </div>
  )
}
