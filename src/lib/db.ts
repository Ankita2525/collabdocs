import postgres from "postgres";

// Server-side only. DATABASE_URL must never be exposed to the browser.
const globalForDb = globalThis as unknown as { __sql?: postgres.Sql };

export function getDb(): postgres.Sql {
  if (!globalForDb.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // Pooled Supabase connection (port 6543, transaction mode):
    // - prepare:false: no named prepared statements through the pooler.
    // - max_pipeline:1: do NOT pipeline several queries on one connection. Through the pooler,
    //   concurrent pipelined queries stall indefinitely (reproduced: 8 parallel queries -> 7 hang
    //   until timeout). With 1 they complete normally.
    // - max:3: small pool, suits serverless instances.
    globalForDb.__sql = postgres(url, {
      prepare: false,
      max: 3,
      max_pipeline: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalForDb.__sql;
}
