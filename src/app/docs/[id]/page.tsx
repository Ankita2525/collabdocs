import { notFound, redirect } from "next/navigation";
import { DocumentEditor } from "@/components/editor/document-editor";
import { ApiError } from "@/lib/errors";
import { loadDocumentFor } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let loaded;
  try {
    // Server-side access check: no access or unknown id renders the 404 page.
    loaded = await loadDocumentFor((await params).id, user, "read");
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const { doc, access } = loaded;
  return (
    <DocumentEditor
      key={doc.id}
      role={access}
      doc={{ id: doc.id, title: doc.title, version: doc.version, content: doc.content, ownerId: doc.ownerId, ownerName: doc.ownerName }}
    />
  );
}
