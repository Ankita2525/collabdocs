"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Avatar } from "@/components/avatar";
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
      <div className="mt-4 rounded-lg border border-destructive/40 p-4 text-sm">
        <p className="text-destructive">Could not load demo users.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  if (!users) {
    return (
      <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading demo users">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[68px]" />
        ))}
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {users.map((u) => (
        <li key={u.id}>
          <button
            onClick={() => login(u.id)}
            disabled={pending !== null}
            className="flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
          >
            <Avatar name={u.name} id={u.id} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{u.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{u.email}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              {pending === u.id ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden /> Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
