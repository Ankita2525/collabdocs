import { z } from "zod";
import { can, getAccess, type Access, type Action } from "@/lib/access";
import { errors } from "@/lib/errors";
import { repo, type DocumentRecord, type User } from "@/lib/repo";

const idSchema = z.uuid();

/**
 * Every document operation goes through here: load, compute access, check the action.
 * No access (or a malformed id) answers 404 so existence is not leaked; insufficient rights answer 403.
 */
export async function loadDocumentFor(
  rawId: string,
  user: User,
  action: Action,
): Promise<{ doc: DocumentRecord; access: Access }> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) throw errors.notFound("Document not found");
  const doc = await repo().getDocument(id.data, user.id);
  const access = doc ? getAccess(doc.ownerId, user.id, doc.shareRole) : null;
  if (!doc || !access) throw errors.notFound("Document not found");
  if (!can(access, action)) throw errors.forbidden();
  return { doc, access };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw errors.badRequest("Request body must be valid JSON");
  }
}
