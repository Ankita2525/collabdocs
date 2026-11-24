import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginPicker } from "@/components/login-picker";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">CollabDocs</h1>
      <p className="mt-2 text-muted-foreground">Choose a demo user to continue.</p>
      <div
        role="note"
        className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      >
        <strong>Demo authentication — not for production.</strong> There are no passwords: selecting a user signs you
        in as that user.
      </div>
      <LoginPicker />
    </main>
  );
}
