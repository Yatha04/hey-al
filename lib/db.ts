import pg from "pg";

// ponytail: one small pool per process (agent worker, Next server); add Neon's pooled URL if connections run out.
export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});
