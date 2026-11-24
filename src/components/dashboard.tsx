"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileTextIcon, FileUpIcon, InboxIcon, MoreHorizontalIcon, PlusIcon, UsersIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { IMPORT_HELP, ImportButton, ImportStatus, useTextImport } from "@/components/import-text";
import { RoleBadge } from "@/components/role-badge";
import { ShareDialog } from "@/components/share-dialog";
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
  const importer = useTextImport();

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

  const importInput = <input {...importer.inputProps} />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">{IMPORT_HELP}</p>
        </div>
        <div className="flex items-center gap-2">
          {importInput}
          <ImportButton busy={importer.busy} onClick={importer.openPicker} />
          <Button onClick={createDocument} disabled={creating || importer.busy}>
            <PlusIcon /> {creating ? "Creating…" : "New document"}
          </Button>
        </div>
      </div>
      <ImportStatus state={importer.state} dismiss={importer.dismiss} />

      {loadError ? (
        <div role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-background p-4 text-sm">
          <p className="text-destructive">{loadError}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : !data ? (
        <ListSkeleton />
      ) : (
        <>
          <SectionHeading title="My documents" count={data.owned.length} />
          {data.owned.length === 0 ? (
            <EmptyState
              icon={<FileTextIcon className="size-5" />}
              title="No documents yet"
              text="Create a blank document, or import a plain-text file to start editing."
            >
              <Button size="sm" onClick={createDocument} disabled={creating || importer.busy}>
                <PlusIcon /> New document
              </Button>
              <Button size="sm" variant="outline" onClick={importer.openPicker} disabled={importer.busy}>
                <FileUpIcon /> Import .txt
              </Button>
            </EmptyState>
          ) : (
            <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-background shadow-xs">
              {data.owned.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  meta={`Updated ${formatDate(d.updatedAt)}`}
                  badges={
                    <>
                      <RoleBadge role="owner" />
                      {d.shareCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <UsersIcon className="size-3" aria-hidden /> Shared with {d.shareCount}
                        </span>
                      )}
                    </>
                  }
                  menu={
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Actions for ${d.title}`}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
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

          <SectionHeading title="Shared with me" count={data.shared.length} className="mt-10" />
          {data.shared.length === 0 ? (
            <EmptyState
              icon={<InboxIcon className="size-5" />}
              title="Nothing shared with you yet"
              text="Documents other people share with you appear here, marked with your level of access."
            />
          ) : (
            <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-background shadow-xs">
              {data.shared.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  meta={`Updated ${formatDate(d.updatedAt)}`}
                  byline={
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={d.ownerName} id={d.ownerId} size="sm" /> Shared by {d.ownerName}
                    </span>
                  }
                  badges={<RoleBadge role={d.role} />}
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
          ownerName={sharing.ownerName}
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

function SectionHeading({ title, count, className = "mt-8" }: { title: string; count: number; className?: string }) {
  return (
    <h2 className={`${className} flex items-baseline gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase`}>
      {title}
      <span className="rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums normal-case">{count}</span>
    </h2>
  );
}

function DocRow({
  doc,
  badges,
  menu,
  meta,
  byline,
}: {
  doc: DocSummary;
  badges: React.ReactNode;
  menu?: React.ReactNode;
  meta: string;
  byline?: React.ReactNode;
}) {
  return (
    <li className="relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
        <FileTextIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        {/* The ::after makes the whole row a click target; the menu sits above it. */}
        <Link
          href={`/docs/${doc.id}`}
          className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          {doc.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {byline}
          <span>{meta}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">{badges}</div>
      </div>
      <div className="hidden items-center gap-1.5 sm:flex">{badges}</div>
      {menu && <div className="relative z-10">{menu}</div>}
    </li>
  );
}

function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed bg-background px-4 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-8" aria-busy="true" aria-label="Loading documents">
      <Skeleton className="h-4 w-32" />
      <div className="mt-3 space-y-px overflow-hidden rounded-xl border bg-background">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[68px] rounded-none" />
        ))}
      </div>
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
          {error && (
            <p role="alert" className="mb-2 text-sm text-destructive">
              {error}
            </p>
          )}
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
