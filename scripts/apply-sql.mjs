// Usage: node --env-file=.env.local scripts/apply-sql.mjs db/schema.sql db/seed.sql
import postgres from "postgres";

const files = process.argv.slice(2);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (files.length === 0) throw new Error("Pass one or more .sql files");

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
try {
  for (const f of files) {
    await sql.file(f, [], { cache: false });
    console.log(`applied ${f}`);
  }
  const users = await sql`select name, email from users order by name`;
  console.table(users);
} finally {
  await sql.end();
}
