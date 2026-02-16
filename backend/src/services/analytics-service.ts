export type AnalyticsEvent = {
  code: string;
  userId?: string;
  payload?: Record<string, unknown>;
  at: string;
};

const events: AnalyticsEvent[] = [];

export function trackEvent(event: Omit<AnalyticsEvent, 'at'>): AnalyticsEvent {
  const withTime: AnalyticsEvent = { ...event, at: new Date().toISOString() };
  events.unshift(withTime);
  if (events.length > 500) {
    events.length = 500;
  }
  return withTime;
}

export function listEvents(limit = 50): AnalyticsEvent[] {
  return events.slice(0, limit);
}
