import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiError } from "@/lib/errors";
import { loadDocumentFor } from "@/lib/documents";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Placeholder until the editor is built in M3. Already enforces server-side access.
export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let loaded;
  try {
    loaded = await loadDocumentFor((await params).id, user, "read");
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to documents
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{loaded.doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your access: {loaded.access}. The editor arrives in M3.</p>
    </div>
  );
}
