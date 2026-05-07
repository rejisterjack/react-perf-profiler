/**
 * Lightweight, privacy-first telemetry utility.
 * All events are stored locally in chrome.storage and can be exported by the user.
 * Nothing is sent to any server unless the user explicitly exports it.
 *
 * Enable via settings: enableTelemetry = true
 */

const STORAGE_KEY = 'telemetry_events';
const MAX_EVENTS = 500;

export interface TelemetryEvent {
  event: string;
  timestamp: number;
  properties?: Record<string, string | number | boolean>;
}

async function getEvents(): Promise<TelemetryEvent[]> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve([]);
      return;
    }
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve((result[STORAGE_KEY] as TelemetryEvent[] | undefined) ?? []);
    });
  });
}

async function saveEvents(events: TelemetryEvent[]): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve();
      return;
    }
    const trimmed = events.slice(-MAX_EVENTS);
    chrome.storage.local.set({ [STORAGE_KEY]: trimmed }, resolve);
  });
}

export async function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>
): Promise<void> {
  const events = await getEvents();
  events.push({
    event,
    timestamp: Date.now(),
    properties,
  });
  await saveEvents(events);
}

export async function getTelemetryEvents(): Promise<TelemetryEvent[]> {
  return getEvents();
}

export async function clearTelemetry(): Promise<void> {
  await saveEvents([]);
}

export async function getTelemetrySummary(): Promise<{
  totalEvents: number;
  eventCounts: Record<string, number>;
  firstEvent: number | null;
  lastEvent: number | null;
}> {
  const events = await getEvents();
  const eventCounts: Record<string, number> = {};
  for (const e of events) {
    eventCounts[e.event] = (eventCounts[e.event] ?? 0) + 1;
  }
  return {
    totalEvents: events.length,
    eventCounts,
    firstEvent: events[0]?.timestamp ?? null,
    lastEvent: events[events.length - 1]?.timestamp ?? null,
  };
}
