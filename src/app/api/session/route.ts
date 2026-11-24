import { handle, errors } from "@/lib/errors";
import { repo } from "@/lib/repo";
import { loginSchema } from "@/lib/schemas";
import { endSession, startSession } from "@/lib/session";

export async function POST(request: Request) {
  return handle(async () => {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw errors.badRequest("A valid userId is required");
    const user = await repo().getUser(parsed.data.userId);
    if (!user) throw errors.notFound("Unknown demo user");
    await startSession(user.id);
    return Response.json({ user });
  });
}

export async function DELETE() {
  return handle(async () => {
    await endSession();
    return Response.json({ ok: true });
  });
}
