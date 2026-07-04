import { env } from '@/lib/env';

type LogContext = Record<string, unknown>;

function serializeContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  try {
    return JSON.stringify(context);
  } catch {
    return '[unserializable context]';
  }
}

function toErrorPayload(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { error };
}

async function reportError(message: string, errorPayload: Record<string, unknown>, context?: LogContext): Promise<void> {
  if (typeof window === 'undefined' || !env.errorReportingEndpoint) {
    return;
  }

  const payload = JSON.stringify({
    level: 'error',
    message,
    ...errorPayload,
    context,
    timestamp: new Date().toISOString(),
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const beaconAccepted = navigator.sendBeacon(
        env.errorReportingEndpoint,
        new Blob([payload], { type: 'application/json' }),
      );

      if (beaconAccepted) {
        return;
      }
    }

    await fetch(env.errorReportingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
      credentials: 'omit',
    });
  } catch {
    // Swallow reporting failures so error logging never becomes user-facing.
  }
}

export function logError(error: unknown, message: string, context?: LogContext): void {
  const serializedContext = serializeContext(context);
  // Keep logging visible in production until an external sink is configured.
  // eslint-disable-next-line no-console
  console.error(message, {
    ...toErrorPayload(error),
    ...(serializedContext ? { context: serializedContext } : {}),
  });

  void reportError(message, toErrorPayload(error), context);
}

export function logInfo(message: string, context?: LogContext): void {
  const serializedContext = serializeContext(context);
  // eslint-disable-next-line no-console
  console.info(message, serializedContext ? { context: serializedContext } : undefined);
}
