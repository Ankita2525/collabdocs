"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type DemoUser = { id: string; name: string; email: string };

export function LoginPicker() {
  const router = useRouter();
  const [users, setUsers] = useState<DemoUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  async function load() {
    setLoadError(false);
    setUsers(null);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error();
      setUsers((await res.json()).users);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function login(userId: string) {
    setPending(userId);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Sign-in failed");
      router.replace("/");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Sign-in failed");
      setPending(null);
    }
  }

  if (loadError) {
    return (
      <div className="mt-8 rounded-md border p-4 text-sm">
        <p className="text-destructive">Could not load demo users.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (!users) {
    return (
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {users.map((u) => (
        <button
          key={u.id}
          onClick={() => login(u.id)}
          disabled={pending !== null}
          className="rounded-lg border bg-card p-4 text-left transition hover:border-foreground/40 hover:shadow-sm focus-visible:outline-2 disabled:opacity-60"
        >
          <div className="text-base font-medium">{u.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{u.email}</div>
          {pending === u.id && <div className="mt-2 text-xs">Signing in…</div>}
        </button>
      ))}
    </div>
  );
}
