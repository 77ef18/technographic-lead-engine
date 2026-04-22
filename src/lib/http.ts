export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return Response.json(
    {
      error: message,
      ...extra,
    },
    { status },
  );
}
