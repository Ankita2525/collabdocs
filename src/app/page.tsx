import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Dashboard />
      </main>
    </div>
  );
}
