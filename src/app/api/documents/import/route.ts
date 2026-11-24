import { handle, errors } from "@/lib/errors";
import { repo } from "@/lib/repo";
import { requireUser } from "@/lib/session";
import { MAX_IMPORT_BYTES, prepareImport } from "@/lib/import-text";

// Allow some multipart overhead on top of the file limit before reading the body.
const MAX_REQUEST_BYTES = MAX_IMPORT_BYTES + 200_000;

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();

    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
      throw errors.tooLarge("The file is larger than the 1 MB limit");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw errors.badRequest("Upload a .txt file as multipart form data");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw errors.badRequest("No file was uploaded (expected a form field named “file”)");
    if (file.size > MAX_IMPORT_BYTES) throw errors.tooLarge("The file is larger than the 1 MB limit");

    const { title, content } = prepareImport({
      name: file.name,
      type: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    // Ownership always comes from the session, never from the request.
    const doc = await repo().createDocument(user.id, title, content);
    return Response.json({ document: doc }, { status: 201 });
  });
}
