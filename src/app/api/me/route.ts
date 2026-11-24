import { handle } from "@/lib/errors";
import { requireUser } from "@/lib/session";

export async function GET() {
  return handle(async () => Response.json({ user: await requireUser() }));
}
