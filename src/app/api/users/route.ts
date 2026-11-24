import { handle } from "@/lib/errors";
import { repo } from "@/lib/repo";

export async function GET() {
  return handle(async () => Response.json({ users: await repo().listUsers() }));
}
