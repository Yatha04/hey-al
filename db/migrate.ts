// Apply db/migrations/*.sql in name order. Each file runs once, in its own transaction.
// ponytail: forward-only, no checksums; switch to a real migration tool when down migrations or drift detection matter.
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const dir = new URL("./migrations/", import.meta.url);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  const pending = readdirSync(dir).filter((f) => f.endsWith(".sql") && !applied.has(f)).sort();
  for (const name of pending) {
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(new URL(name, dir), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
    console.log(`applied ${name}`);
  }
  console.log(`${pending.length} applied, ${applied.size} already present`);
} finally {
  await client.end();
}
