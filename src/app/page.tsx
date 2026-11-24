import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Dashboard } from "@/components/dashboard";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between border-b pb-4">
        <h1 className="text-xl font-semibold">CollabDocs</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Signed in as {user.name}</span>
          <LogoutButton />
        </div>
      </header>
      <Dashboard />
    </div>
  );
}
