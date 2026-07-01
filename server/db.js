// server/db.js — PostgreSQL connection pool and helpers.
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Local Postgres: no SSL. Supabase: set DATABASE_SSL=true in .env.
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => console.error("Unexpected PG pool error:", err));

export const query = (text, params) => pool.query(text, params);

// Run a function inside a single transaction (BEGIN/COMMIT/ROLLBACK).
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
