import { handle, errors } from "@/lib/errors";
import { repo } from "@/lib/repo";
import { requireUser } from "@/lib/session";
import { firstIssue, patchDocumentSchema } from "@/lib/schemas";
import { loadDocumentFor, readJson } from "@/lib/documents";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { doc, access } = await loadDocumentFor((await params).id, user, "read");
    return Response.json({ document: doc, role: access });
  });
}

export async function PATCH(request: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    // Rename is owner-only. (Content saves are added in M3 with their own permission.)
    const { doc } = await loadDocumentFor(id, user, "rename");
    const parsed = patchDocumentSchema.safeParse(await readJson(request));
    if (!parsed.success) throw errors.badRequest(firstIssue(parsed.error));
    const updated = await repo().renameDocument(doc.id, parsed.data.title!);
    if (!updated) throw errors.notFound("Document not found");
    return Response.json({ document: updated });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { doc } = await loadDocumentFor((await params).id, user, "delete");
    await repo().deleteDocument(doc.id);
    return Response.json({ ok: true });
  });
}
