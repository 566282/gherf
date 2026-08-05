export interface DashboardTelemetryEvent {
  area: 'user' | 'business' | 'merchant';
  action: string;
  metadata?: Record<string, unknown>;
}

const telemetryEventName = 'dashboard:interaction';

export function emitDashboardTelemetry(event: DashboardTelemetryEvent): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  window.dispatchEvent(new CustomEvent(telemetryEventName, { detail: payload }));

  const dataLayer = (window as { dataLayer?: Array<Record<string, unknown>> }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push({
      event: telemetryEventName,
      ...payload,
    });
  }
}
