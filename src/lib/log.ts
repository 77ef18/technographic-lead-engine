type LogLevel = "info" | "error";

export function logEvent(level: LogLevel, event: string, payload: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  };
  // Structured logs for simple observability and ingestion into platform logs.
  console[level](JSON.stringify(line));
}
