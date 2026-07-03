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

export function logError(error: unknown, message: string, context?: LogContext): void {
  const serializedContext = serializeContext(context);
  // Keep logging visible in production until an external sink is configured.
  // eslint-disable-next-line no-console
  console.error(message, {
    ...toErrorPayload(error),
    ...(serializedContext ? { context: serializedContext } : {}),
  });
}

export function logInfo(message: string, context?: LogContext): void {
  const serializedContext = serializeContext(context);
  // eslint-disable-next-line no-console
  console.info(message, serializedContext ? { context: serializedContext } : undefined);
}
