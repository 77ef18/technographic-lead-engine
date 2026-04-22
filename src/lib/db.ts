import { Pool } from "pg";

declare global {
  var __dbPool: Pool | undefined;
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!global.__dbPool) {
    global.__dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
    });
  }

  return global.__dbPool;
}

export async function dbQuery<T = unknown>(text: string, params: unknown[] = []) {
  const pool = getPool();
  return pool.query<T>(text, params);
}
