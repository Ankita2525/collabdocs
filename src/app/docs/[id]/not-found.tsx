import Link from "next/link";

export default function DocumentNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Document not found</h1>
      <p className="mt-2 text-muted-foreground">
        It may have been deleted, or you may not have access to it.
      </p>
      <Link href="/" className="mt-6 text-sm underline underline-offset-4">
        Back to your documents
      </Link>
    </main>
  );
}
