"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      const res = await fetch("/api/session", { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={logout} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
