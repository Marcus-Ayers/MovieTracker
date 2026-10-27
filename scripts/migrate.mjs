// Applies database migrations to Postgres (Neon in production). Runs before every Vercel build.
// Locally there's no DATABASE_URL: the built-in database migrates itself, so this does nothing.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Prefer Neon's direct (unpooled) connection for schema changes.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log("migrate: no DATABASE_URL, skipping (local dev uses the built-in database).");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  console.log("migrate: database is up to date.");
} finally {
  await pool.end();
}
