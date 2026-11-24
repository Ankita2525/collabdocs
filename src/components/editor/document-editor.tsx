"use client";

import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, Loader2Icon, Share2Icon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoMark } from "@/components/brand";
import { RoleBadge } from "@/components/role-badge";
import { ShareDialog } from "@/components/share-dialog";
import { stableStringify } from "@/lib/json";
import { editorExtensions } from "@/lib/editor-extensions";
import type { Access } from "@/lib/access";
import { Toolbar } from "@/components/editor/toolbar";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const AUTOSAVE_MS = 1500;
const JSON_HEADERS = { "content-type": "application/json" };

export type EditorDoc = {
  id: string;
  title: string;
  version: number;
  content: unknown;
  ownerId: string;
  ownerName: string;
};

/** Set when the server tells an already-open editor that its access changed. */
type LostAccess = "readonly" | "revoked" | null;
const RECHECK_MIN_MS = 5000;

export function DocumentEditor({ doc, role }: { doc: EditorDoc; role: Access }) {
  const [lostAccess, setLostAccess] = useState<LostAccess>(null);
  const [sharing, setSharing] = useState(false);
  const canSave = role !== "viewer"; // may this user edit at all, as of page load
  const canEdit = canSave && !lostAccess; // ...and still can, as far as the server has told us
  const isOwner = role === "owner";
  const lostRef = useRef<LostAccess>(null);
  const lastRecheck = useRef(0);

  const [state, setStateRaw] = useState<SaveState>("saved");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const stateRef = useRef<SaveState>("saved");
  const setState = useCallback((s: SaveState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const versionRef = useRef(doc.version);
  const editSeq = useRef(0); // bumped on every user edit
  const savedSeq = useRef(0); // edit number covered by the last successful save
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowUnload = useRef(false);
  const saveRef = useRef<() => void>(() => {}); // lets save() schedule itself without referencing itself

  const editor = useEditor({
    extensions: editorExtensions,
    content: doc.content as object,
    editable: canEdit,
    immediatelyRender: false, // avoid SSR hydration mismatch
    editorProps: {
      attributes: { "aria-label": "Document content", class: "focus:outline-none" },
    },
  });

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const save = useCallback(async () => {
    if (!editor || !canEdit || inFlight.current || stateRef.current === "conflict" || lostRef.current) return;
    clearTimer();
    if (editSeq.current === savedSeq.current) {
      setState("saved");
      return;
    }
    inFlight.current = true;
    const seq = editSeq.current;
    setState("saving");
    try {
      const sent = editor.getJSON();
      let res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ content: sent, baseVersion: versionRef.current }),
      });
      let body = await res.json().catch(() => null);
      if (res.status === 409) {
        // A 409 can be our OWN earlier save whose response was lost (e.g. the connection dropped
        // after the server applied it). If the stored document equals what we just sent, adopt its
        // version instead of reporting a false conflict.
        const latest = await fetch(`/api/documents/${doc.id}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (latest && stableStringify(latest.document.content) === stableStringify(sent)) {
          body = { document: { version: latest.document.version, updatedAt: latest.document.updatedAt } };
          res = { ...res, ok: true, status: 200 } as Response;
        } else {
          setState("conflict");
          return;
        }
      }
      if (res.status === 403 || res.status === 404) {
        // The server re-checks access on every save. Stop saving and make the editor read-only.
        const kind: LostAccess = res.status === 404 ? "revoked" : "readonly";
        lostRef.current = kind;
        setLostAccess(kind);
        clearTimer();
        return;
      }
      if (!res.ok) throw new Error(body?.error?.message ?? "The server rejected the save");
      versionRef.current = body.document.version;
      savedSeq.current = seq;
      setSavedAt(new Date(body.document.updatedAt));
      if (editSeq.current !== seq) {
        // The user kept typing while the request was in flight.
        setState("dirty");
        timer.current = setTimeout(() => saveRef.current(), AUTOSAVE_MS);
      } else {
        setState("saved");
      }
    } catch (e) {
      setErrorMsg(e instanceof TypeError ? "Network error" : e instanceof Error ? e.message : "Save failed");
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [editor, canEdit, doc.id, setState]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  // Non-owners: re-check access when the tab regains focus, so a revoked or downgraded user
  // sees it without having to type. (The server enforces access on every request regardless.)
  useEffect(() => {
    if (isOwner) return;
    const recheck = async () => {
      if (document.visibilityState !== "visible" || lostRef.current) return;
      if (Date.now() - lastRecheck.current < RECHECK_MIN_MS) return;
      lastRecheck.current = Date.now();
      try {
        const res = await fetch(`/api/documents/${doc.id}`, { cache: "no-store" });
        let kind: LostAccess = null;
        if (res.status === 404) kind = "revoked";
        else if (res.ok && role === "editor" && (await res.json()).role === "viewer") kind = "readonly";
        if (kind) {
          lostRef.current = kind;
          setLostAccess(kind);
        }
      } catch {
        // Offline or transient error: ignore; the next save or focus will find out.
      }
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [isOwner, role, doc.id]);

  // Debounced autosave on every edit.
  useEffect(() => {
    if (!editor || !canEdit) return;
    const onUpdate = () => {
      editSeq.current += 1;
      if (stateRef.current === "conflict") return;
      if (stateRef.current !== "saving") setState("dirty");
      clearTimer();
      timer.current = setTimeout(() => saveRef.current(), AUTOSAVE_MS);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      clearTimer();
    };
  }, [editor, canEdit, setState]);

  const hasUnsaved =
    state === "dirty" || state === "saving" || state === "error" || state === "conflict" || (lostAccess !== null && state !== "saved");

  // Warn before leaving with unsaved work. This only shows the browser prompt; it never sends a request.
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (allowUnload.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  // Ctrl/Cmd+S saves immediately.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canEdit) void save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save, canEdit]);

  function onBackClick(e: React.MouseEvent) {
    if (hasUnsaved && !window.confirm("You have unsaved changes. Leave without saving?")) e.preventDefault();
  }

  function reload() {
    allowUnload.current = true;
    window.location.reload();
  }

  async function copyMyText() {
    try {
      await navigator.clipboard.writeText(editor?.getText() ?? "");
      toast.success("Your text was copied to the clipboard");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-2.5 sm:px-6">
          <Link
            href="/"
            onClick={onBackClick}
            aria-label="Back to documents"
            title="Back to documents"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <LogoMark />
          </Link>
          <div className="order-last flex min-w-0 basis-full items-center gap-2 sm:order-none sm:basis-0 sm:flex-1">
            <TitleField docId={doc.id} initial={doc.title} editable={isOwner} />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <RoleBadge role={role} />
            {canSave && (
              <SaveIndicator state={state} savedAt={savedAt} errorMsg={errorMsg} onRetry={save} lostAccess={lostAccess} />
            )}
            {canSave && (
              <Button size="sm" onClick={save} disabled={!editor || !canEdit || state === "saving" || state === "conflict"}>
                {state === "saving" ? "Saving…" : "Save"}
              </Button>
            )}
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setSharing(true)}>
                <Share2Icon /> Share
              </Button>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-4xl px-4 py-2 sm:px-6">
          <div className="rounded-lg border bg-background px-1.5 py-1 shadow-xs">
            <Toolbar editor={editor} disabled={!canEdit} />
          </div>
          {sharing && (
            <ShareDialog
              docId={doc.id}
              docTitle={doc.title}
              ownerId={doc.ownerId}
              ownerName={doc.ownerName}
              onClose={() => setSharing(false)}
            />
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        {lostAccess && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
          >
            <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
            <p className="min-w-0 flex-1">
              {lostAccess === "revoked" ? (
                <>
                  <strong>This document is no longer available to you</strong> (it was unshared or deleted). It is shown read-only.
                  {canSave && state !== "saved" ? " Your latest edits were not saved." : ""}
                </>
              ) : (
                <>
                  <strong>Your access changed to view-only.</strong> The editor is now read-only
                  {state !== "saved" ? " and your latest edits were not saved" : ""}.
                </>
              )}{" "}
              Copy your text if you need it.
            </p>
            <Button size="sm" variant="outline" onClick={copyMyText}>
              Copy my text
            </Button>
            {lostAccess === "readonly" ? (
              <Button size="sm" onClick={reload}>
                Reload
              </Button>
            ) : (
              <Link
                href="/"
                onClick={() => {
                  allowUnload.current = true;
                }}
                className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground"
              >
                Back to documents
              </Link>
            )}
          </div>
        )}
        {!canSave && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm text-muted-foreground"
          >
            <EyeIcon className="size-4 shrink-0" aria-hidden />
            <span>
              You have <strong className="font-medium text-foreground">view-only</strong> access to this document. Shared
              by {doc.ownerName}.
            </span>
          </div>
        )}
        {role === "editor" && (
          <p className="mb-4 text-sm text-muted-foreground">Shared with you by {doc.ownerName}. You can edit the content.</p>
        )}
        {state === "conflict" && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
          >
            <TriangleAlertIcon className="size-4 shrink-0 text-destructive" />
            <p className="min-w-0 flex-1">
              <strong>This document was changed elsewhere.</strong> Your latest edits were not saved, to avoid overwriting
              the newer version. Copy your text if you need it, then reload to get the latest version.
            </p>
            <Button size="sm" variant="outline" onClick={copyMyText}>
              Copy my text
            </Button>
            <Button size="sm" onClick={reload}>
              Reload latest
            </Button>
          </div>
        )}
        <div className="doc-editor rounded-xl border bg-background px-6 py-10 shadow-sm sm:px-16 sm:py-14">
          {editor ? <EditorContent editor={editor} /> : <Skeleton className="h-64 w-full" aria-label="Loading editor" />}
        </div>
      </main>
    </div>
  );
}

function SaveIndicator({
  state,
  savedAt,
  errorMsg,
  onRetry,
  lostAccess,
}: {
  state: SaveState;
  savedAt: Date | null;
  errorMsg: string;
  onRetry: () => void;
  lostAccess: LostAccess;
}) {
  const time = savedAt?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const pill = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap";
  if (lostAccess) {
    return (
      <div aria-live="polite" data-save-state="denied" className={`${pill} border-red-200 bg-red-50 text-red-800`}>
        <TriangleAlertIcon className="size-3.5" aria-hidden /> Not saved: access changed
      </div>
    );
  }
  return (
    <div aria-live="polite" data-save-state={state}>
      {state === "saved" && (
        <span className={`${pill} text-muted-foreground`}>
          <CheckIcon className="size-3.5 text-emerald-600" aria-hidden /> {time ? `Saved at ${time}` : "Saved"}
        </span>
      )}
      {state === "dirty" && (
        <span className={`${pill} border-amber-300 bg-amber-50 text-amber-900`}>
          <span className="size-1.5 rounded-full bg-amber-600" aria-hidden /> Unsaved changes
        </span>
      )}
      {state === "saving" && (
        <span className={`${pill} text-muted-foreground`}>
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> Saving…
        </span>
      )}
      {state === "error" && (
        <span className={`${pill} border-red-200 bg-red-50 text-red-800`}>
          <TriangleAlertIcon className="size-3.5" aria-hidden /> Save failed{errorMsg ? ` (${errorMsg})` : ""}
          <button className="underline underline-offset-2" onClick={onRetry}>
            Retry
          </button>
        </span>
      )}
      {state === "conflict" && (
        <span className={`${pill} border-red-200 bg-red-50 text-red-800`}>
          <TriangleAlertIcon className="size-3.5" aria-hidden /> Not saved: conflict
        </span>
      )}
    </div>
  );
}

function TitleField({ docId, initial, editable }: { docId: string; initial: string; editable: boolean }) {
  const [title, setTitle] = useState(initial);
  const [committed, setCommitted] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function commit() {
    const next = title.trim();
    if (!editable || next === committed) {
      setTitle(committed);
      return;
    }
    if (next.length < 1 || next.length > 200) {
      toast.error(next.length < 1 ? "Title cannot be empty" : "Title must be 200 characters or fewer");
      setTitle(committed);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ title: next }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Could not rename");
      setCommitted(body.document.title);
      setTitle(body.document.title);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not rename");
      setTitle(committed);
    } finally {
      setBusy(false);
    }
  }

  if (!editable) {
    return (
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold" title={committed}>
        {committed}
      </h1>
    );
  }
  return (
    <Input
      value={title}
      disabled={busy}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setTitle(committed);
          e.currentTarget.blur();
        }
      }}
      aria-label="Document title"
      maxLength={200}
      className="min-w-0 flex-1 border-transparent bg-transparent text-base font-semibold shadow-none hover:border-input focus-visible:border-ring"
    />
  );
}
