import postgres from "postgres";

// Server-side only. DATABASE_URL must never be exposed to the browser.
const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

export function getDb(): postgres.Sql {
  if (!globalForDb.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // Pooled Supabase connection (port 6543) needs prepare:false; max:1 suits serverless.
    globalForDb.__sql = postgres(url, { prepare: false, max: 1, idle_timeout: 20, connect_timeout: 10 });
  }
  return globalForDb.__sql;
}
