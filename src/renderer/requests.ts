import type { InspectorEvent } from '../types'

export function requestsForDevice(events: Iterable<InspectorEvent>, device: string): InspectorEvent[] {
  return [...events].filter((item) => item.device === device)
}

export function filterRequests(items: InspectorEvent[], appFilter: string, search: string): InspectorEvent[] {
  const query = search.trim().toLowerCase()
  return items.filter((item) => (!appFilter || item.bundleName === appFilter) &&
    (!query || `${item.method} ${item.url} ${item.status || ''}`.toLowerCase().includes(query)))
}
