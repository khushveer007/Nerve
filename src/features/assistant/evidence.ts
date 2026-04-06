import type {
  AssistantCitation,
  AssistantCitationLocator,
  AssistantSourceReference,
} from './types'

function formatPageRange(locator: AssistantCitationLocator) {
  if (locator.page_from === null) {
    return null
  }

  if (locator.page_to !== null && locator.page_to !== locator.page_from) {
    return `Pages ${locator.page_from}-${locator.page_to}`
  }

  return `Page ${locator.page_from}`
}

export function buildAssistantSourceKey(source: AssistantSourceReference) {
  return [
    source.asset_id,
    source.asset_version_id,
    source.chunk_id,
    source.entry_id,
    source.source_kind,
  ].join(':')
}

export function formatCitationLocatorContext(locator: AssistantCitationLocator) {
  const heading = locator.heading_path.join(' > ') || 'Entry overview'
  const pageRange = formatPageRange(locator)

  return pageRange ? `${heading}, ${pageRange}` : heading
}

export function buildCitationAccessibleLabel(citation: AssistantCitation) {
  return `Inspect citation ${citation.label} for ${citation.title} at ${formatCitationLocatorContext(citation.citation_locator)}`
}

export function buildLocatorDetails(locator: AssistantCitationLocator) {
  const details = []
  const heading = locator.heading_path.join(' > ')

  if (heading) {
    details.push(heading)
  }

  const pageRange = formatPageRange(locator)
  if (pageRange) {
    details.push(pageRange)
  }

  if (details.length === 0) {
    details.push('Entry overview')
  }

  return details
}
