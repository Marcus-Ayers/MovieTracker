import "server-only";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { connection } from "next/server";
import * as schema from "./schema";

/**
 * The database connection. Production uses Postgres on Neon (DATABASE_URL); local development uses PGlite, an
 * embedded Postgres stored in .data/ that applies new migrations by itself. Both go through Drizzle ORM with the
 * same query builder, so the rest of the code doesn't know or care which one it's talking to.
 */

export type DB = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");
const JOURNAL = path.join(MIGRATIONS, "meta", "_journal.json");

const globalForDb = globalThis as unknown as {
  dbPromise?: Promise<DB>;
  migratedJournal?: string;
  migrating?: Promise<void>;
};

const isLocal = () => !process.env.DATABASE_URL?.trim();

async function createDb(): Promise<DB> {
  // Production (Neon or any Postgres): migrations run at build time via `npm run db:migrate`.
  if (!isLocal()) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    return drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL }), schema });
  }

  // Local dev: an embedded Postgres stored in .data/.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dataDir, { recursive: true });
  // Both drivers expose the same query builder; the cast just unifies the type.
  return drizzle({ client: new PGlite(dataDir), schema }) as unknown as DB;
}

/** Local dev: apply any new migrations, including ones added while the dev server is running. */
async function migrateLocal(db: DB) {
  const journal = readFileSync(JOURNAL, "utf8");
  if (journal === globalForDb.migratedJournal) return;
  globalForDb.migrating ??= (async () => {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as unknown as PgliteDatabase<typeof schema>, { migrationsFolder: MIGRATIONS });
    globalForDb.migratedJournal = journal;
  })().finally(() => {
    globalForDb.migrating = undefined;
  });
  await globalForDb.migrating;
}

/**
 * Database reads are personal, per-request data, so they must never run during prerendering.
 * `connection()` tells Next.js to wait for a real request before continuing.
 */
export async function getDb(): Promise<DB> {
  await connection();
  globalForDb.dbPromise ??= createDb().catch((error) => {
    globalForDb.dbPromise = undefined;
    throw error;
  });
  const db = await globalForDb.dbPromise;
  if (isLocal()) await migrateLocal(db);
  return db;
}

export * from "./schema";
