import { redirect } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { LoginPicker } from "@/components/login-picker";
import { LogoMark } from "@/components/brand";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <LogoMark className="size-12 rounded-2xl [&_svg]:size-6" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">CollabDocs</h1>
        <p className="mt-1.5 text-muted-foreground">Write, import and share documents with your team.</p>
      </div>

      <div className="mt-8 rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-medium">Choose a demo user to continue</h2>
        <LoginPicker />
        <div
          role="note"
          className="mt-5 flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm text-amber-950"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
          <p>
            <strong>Demo authentication — not for production.</strong> There are no passwords: selecting a user signs you
            in as that user.
          </p>
        </div>
      </div>
    </main>
  );
}
