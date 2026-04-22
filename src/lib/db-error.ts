type PgLikeError = {
  code?: string;
  message?: string;
  errors?: Array<{ code?: string }>;
};

const transientDbCodes = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "57P01",
  "57P02",
  "57P03",
]);

export function isDatabaseUnavailable(error: unknown) {
  const pgError = error as PgLikeError;

  if (pgError?.code && transientDbCodes.has(pgError.code)) {
    return true;
  }

  if (Array.isArray(pgError?.errors)) {
    return pgError.errors.some((inner) => inner?.code && transientDbCodes.has(inner.code));
  }

  return false;
}
