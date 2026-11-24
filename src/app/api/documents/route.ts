import { handle, errors } from "@/lib/errors";
import { repo } from "@/lib/repo";
import { requireUser } from "@/lib/session";
import { DEFAULT_TITLE, createDocumentSchema, firstIssue } from "@/lib/schemas";
import { readJson } from "@/lib/documents";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return Response.json(await repo().listDocuments(user.id));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const parsed = createDocumentSchema.safeParse(await readJson(request));
    if (!parsed.success) throw errors.badRequest(firstIssue(parsed.error));
    const doc = await repo().createDocument(user.id, parsed.data.title ?? DEFAULT_TITLE);
    return Response.json({ document: doc }, { status: 201 });
  });
}
