"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShareRole } from "@/lib/access";
import type { ShareEntry, User } from "@/lib/repo";

const ROLE_LABEL: Record<ShareRole, string> = { viewer: "Can view", editor: "Can edit" };
const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong");
  return body as T;
}
const post = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

export function ShareDialog({
  docId,
  docTitle,
  ownerId,
  onClose,
}: {
  docId: string;
  docTitle: string;
  ownerId: string;
  onClose: () => void;
}) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [shares, setShares] = useState<ShareEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickUser, setPickUser] = useState("");
  const [pickRole, setPickRole] = useState<ShareRole>("viewer");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [u, s] = await Promise.all([
        api<{ users: User[] }>("/api/users"),
        api<{ shares: ShareEntry[] }>(`/api/documents/${docId}/shares`),
      ]);
      setUsers(u.users);
      setShares(s.shares);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load sharing settings");
    }
  }, [docId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const sharedIds = new Set((shares ?? []).map((s) => s.userId));
  const candidates = (users ?? []).filter((u) => u.id !== ownerId && !sharedIds.has(u.id));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!pickUser) {
      setAddError("Choose a user to share with");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await api(`/api/documents/${docId}/shares`, post({ userId: pickUser, role: pickRole }));
      const who = users?.find((u) => u.id === pickUser)?.name ?? "user";
      toast.success(`Shared with ${who} (${ROLE_LABEL[pickRole].toLowerCase()})`);
      setPickUser("");
      await load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not share");
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(s: ShareEntry, role: ShareRole) {
    setBusyId(s.userId);
    try {
      await api(`/api/documents/${docId}/shares`, post({ userId: s.userId, role }));
      toast.success(`${s.name} can now ${role === "editor" ? "edit" : "only view"}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change access");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(s: ShareEntry) {
    setBusyId(s.userId);
    try {
      await api(`/api/documents/${docId}/shares/${s.userId}`, { method: "DELETE" });
      toast.success(`Removed ${s.name}'s access`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove access");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share “{docTitle}”</DialogTitle>
          <DialogDescription>Viewers can read. Editors can read and edit. Only you can manage sharing.</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <div className="rounded-md border border-destructive/40 p-3 text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button className="mt-2" size="sm" variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        ) : !shares || !users ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading sharing settings">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <>
            <form onSubmit={add} className="flex flex-wrap items-center gap-2">
              <select
                className={`${selectClass} min-w-0 flex-1`}
                value={pickUser}
                onChange={(e) => setPickUser(e.target.value)}
                aria-label="User to share with"
                disabled={candidates.length === 0 || adding}
              >
                <option value="">{candidates.length === 0 ? "Everyone already has access" : "Choose a user…"}</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={pickRole}
                onChange={(e) => setPickRole(e.target.value as ShareRole)}
                aria-label="Role"
                disabled={adding}
              >
                <option value="viewer">{ROLE_LABEL.viewer}</option>
                <option value="editor">{ROLE_LABEL.editor}</option>
              </select>
              <Button type="submit" size="sm" disabled={adding || candidates.length === 0}>
                {adding ? "Sharing…" : "Share"}
              </Button>
            </form>
            {addError && (
              <p role="alert" className="text-sm text-destructive">
                {addError}
              </p>
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium">People with access</h3>
              {shares.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  Not shared with anyone yet.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {shares.map((s) => (
                    <li key={s.userId} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.email}</div>
                      </div>
                      <select
                        className={selectClass}
                        value={s.role}
                        onChange={(e) => changeRole(s, e.target.value as ShareRole)}
                        disabled={busyId === s.userId}
                        aria-label={`Role for ${s.name}`}
                      >
                        <option value="viewer">{ROLE_LABEL.viewer}</option>
                        <option value="editor">{ROLE_LABEL.editor}</option>
                      </select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => revoke(s)}
                        disabled={busyId === s.userId}
                        aria-label={`Remove ${s.name}'s access`}
                        title="Remove access"
                      >
                        <Trash2Icon />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
