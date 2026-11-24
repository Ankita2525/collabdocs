import { z } from "zod";
import { handle, errors } from "@/lib/errors";
import { repo } from "@/lib/repo";
import { requireUser } from "@/lib/session";
import { loadDocumentFor } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string; userId: string }> };

/** Revoke a user's access. Owner-only. */
export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id, userId } = await params;
    const { doc } = await loadDocumentFor(id, user, "share");
    const target = z.uuid().safeParse(userId);
    if (!target.success) throw errors.badRequest("Invalid user");
    const removed = await repo().deleteShare(doc.id, target.data);
    if (!removed) throw errors.notFound("That user does not have access");
    return Response.json({ ok: true });
  });
}
