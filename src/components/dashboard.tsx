"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileTextIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareDialog } from "@/components/share-dialog";
import type { DocSummary, DocumentList } from "@/lib/repo";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong");
  return body as T;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function Dashboard() {
  const [data, setData] = useState<DocumentList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<DocSummary | null>(null);
  const [deleting, setDeleting] = useState<DocSummary | null>(null);
  const [sharing, setSharing] = useState<DocSummary | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await api<DocumentList>("/api/documents"));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load documents");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function createDocument() {
    setCreating(true);
    try {
      await api("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      toast.success("Document created");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create document");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My documents</h2>
        <Button onClick={createDocument} disabled={creating}>
          <PlusIcon /> {creating ? "Creating…" : "New document"}
        </Button>
      </div>

      {loadError ? (
        <div className="mt-4 rounded-lg border border-destructive/40 p-4 text-sm">
          <p className="text-destructive">{loadError}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : !data ? (
        <ListSkeleton />
      ) : (
        <>
          {data.owned.length === 0 ? (
            <EmptyState text="You haven't created any documents yet. Click “New document” to start." />
          ) : (
            <ul className="mt-4 divide-y rounded-lg border">
              {data.owned.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  badge={
                    <>
                      <Badge>Owner</Badge>
                      {d.shareCount > 0 && <Badge variant="outline">Shared with {d.shareCount}</Badge>}
                    </>
                  }
                  menu={
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Actions for ${d.title}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setRenaming(d)}>Rename</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSharing(d)}>Share…</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleting(d)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              ))}
            </ul>
          )}

          <h2 className="mt-10 text-lg font-semibold">Shared with me</h2>
          {data.shared.length === 0 ? (
            <EmptyState text="Nothing has been shared with you yet." />
          ) : (
            <ul className="mt-4 divide-y rounded-lg border">
              {data.shared.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  subtitle={`Shared by ${d.ownerName}`}
                  badge={<Badge variant="secondary">Shared · {d.role === "editor" ? "Can edit" : "View only"}</Badge>}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {sharing && (
        <ShareDialog
          key={sharing.id}
          docId={sharing.id}
          docTitle={sharing.title}
          ownerId={sharing.ownerId}
          onClose={() => {
            setSharing(null);
            void load();
          }}
        />
      )}
      {renaming && (
        <RenameDialog
          key={renaming.id}
          doc={renaming}
          onClose={() => setRenaming(null)}
          onDone={async () => {
            setRenaming(null);
            toast.success("Document renamed");
            await load();
          }}
        />
      )}
      <DeleteDialog
        doc={deleting}
        onClose={() => setDeleting(null)}
        onDone={async () => {
          setDeleting(null);
          toast.success("Document deleted");
          await load();
        }}
      />
    </div>
  );
}

function DocRow({
  doc,
  badge,
  menu,
  subtitle,
}: {
  doc: DocSummary;
  badge: React.ReactNode;
  menu?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
      <Link href={`/docs/${doc.id}`} className="min-w-0 flex-1 hover:underline">
        <div className="truncate font-medium">{doc.title}</div>
        <div className="text-xs text-muted-foreground">
          {subtitle ? `${subtitle} · ` : ""}Updated {formatDate(doc.updatedAt)}
        </div>
      </Link>
      {badge}
      {menu}
    </li>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-4 space-y-2" aria-busy="true" aria-label="Loading documents">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

function RenameDialog({
  doc,
  onClose,
  onDone,
}: {
  doc: DocSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>Choose a new title (1–200 characters).</DialogDescription>
          </DialogHeader>
          <Input
            className="my-4"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Document title"
            aria-invalid={error ? true : undefined}
            autoFocus
          />
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  doc,
  onClose,
  onDone,
}: {
  doc: DocSummary | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!doc) return;
    setBusy(true);
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{doc?.title}”?</DialogTitle>
          <DialogDescription>
            This permanently deletes the document and removes it for anyone it is shared with. It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
