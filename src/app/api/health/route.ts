import { handle } from "@/lib/errors";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await getDb()`select 1`;
    return Response.json({ ok: true });
  });
}
