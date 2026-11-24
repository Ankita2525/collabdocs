import { handle, errors } from "@/lib/errors";
import { repo } from "@/lib/repo";
import { requireUser } from "@/lib/session";
import { firstIssue, patchDocumentSchema } from "@/lib/schemas";
import { loadDocumentFor, readJson } from "@/lib/documents";
import { validateContent } from "@/lib/content";

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
    const raw = await readJson(request);
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
    // The permission depends on what is being changed: content needs edit rights, a rename needs ownership.
    const action = body && "content" in body ? "editContent" : "rename";
    const { doc } = await loadDocumentFor(id, user, action);

    const parsed = patchDocumentSchema.safeParse(raw);
    if (!parsed.success) throw errors.badRequest(firstIssue(parsed.error));

    if (parsed.data.content !== undefined) {
      const checked = validateContent(parsed.data.content);
      if (!checked.ok) throw errors.badRequest(checked.message);
      const saved = await repo().updateContent(doc.id, checked.doc, parsed.data.baseVersion!);
      if (!saved) {
        // No row matched: either the document vanished or someone saved first.
        const current = await repo().getDocument(doc.id, user.id);
        if (!current) throw errors.notFound("Document not found");
        throw errors.conflict("This document was changed elsewhere. Reload to get the latest version.");
      }
      return Response.json({ document: { id: doc.id, version: saved.version, updatedAt: saved.updatedAt } });
    }

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
