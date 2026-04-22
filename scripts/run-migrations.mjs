import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const MIGRATION_TABLE = "_migrations";
const migrationsDir = path.join(process.cwd(), "db", "migrations");

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(pool) {
  const result = await pool.query(`SELECT filename FROM ${MIGRATION_TABLE}`);
  return new Set(result.rows.map((row) => row.filename));
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run migrations.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const filename of files) {
      if (applied.has(filename)) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
      await client.query(sql);
      await client.query(`INSERT INTO ${MIGRATION_TABLE} (filename) VALUES ($1)`, [filename]);
      console.log(`Applied migration: ${filename}`);
    }

    await client.query("COMMIT");
    console.log("Migrations complete.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
