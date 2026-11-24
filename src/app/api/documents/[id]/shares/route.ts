import { handle, errors } from "@/lib/errors";
import { repo } from "@/lib/repo";
import { requireUser } from "@/lib/session";
import { firstIssue, shareSchema } from "@/lib/schemas";
import { loadDocumentFor, readJson } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

// Sharing management is owner-only: loadDocumentFor(..., "share") answers 404 to strangers
// and 403 to viewers/editors.

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { doc } = await loadDocumentFor((await params).id, user, "share");
    return Response.json({ shares: await repo().listShares(doc.id) });
  });
}

/** Share with a user, or change that user's role (idempotent upsert). */
export async function POST(request: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { doc } = await loadDocumentFor((await params).id, user, "share");
    const parsed = shareSchema.safeParse(await readJson(request));
    if (!parsed.success) throw errors.badRequest(firstIssue(parsed.error));
    const { userId, role } = parsed.data;
    if (userId === doc.ownerId) throw errors.badRequest("You already own this document");
    const target = await repo().getUser(userId);
    if (!target) throw errors.notFound("That user does not exist");
    await repo().upsertShare(doc.id, target.id, role);
    return Response.json({ share: { userId: target.id, name: target.name, email: target.email, role } });
  });
}
