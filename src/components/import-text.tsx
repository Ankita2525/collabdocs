"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircleIcon, FileUpIcon, Loader2Icon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_IMPORT_BYTES } from "@/lib/import-limits";

export const IMPORT_HELP = "Import supports .txt files only (UTF-8 plain text, up to 1 MB).";

export type ImportState =
  | { kind: "idle" }
  | { kind: "uploading"; name: string; percent: number }
  | { kind: "converting"; name: string }
  | { kind: "error"; name: string; message: string };

type UploadResult = { status: number; body: { document?: { id: string; title: string }; error?: { message?: string } } | null };

/** fetch() cannot report upload progress, so use XMLHttpRequest. */
function uploadFile(file: File, onProgress: (percent: number) => void, onSent: () => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/import");
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = onSent;
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response (e.g. proxy error page)
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The upload timed out. Please try again."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Quick client-side checks for instant feedback. The server re-validates everything. */
function checkLocally(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".txt")) return "Only .txt files are supported.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_IMPORT_BYTES) return "The file is larger than the 1 MB limit.";
  return null;
}

export function useTextImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({ kind: "idle" });
  const busy = state.kind === "uploading" || state.kind === "converting";

  function fail(name: string, message: string) {
    setState({ kind: "error", name, message });
    toast.error(`Import failed: ${message}`);
  }

  async function onFile(file: File) {
    const problem = checkLocally(file);
    if (problem) return fail(file.name, problem);
    setState({ kind: "uploading", name: file.name, percent: 0 });
    try {
      const { status, body } = await uploadFile(
        file,
        (percent) => setState({ kind: "uploading", name: file.name, percent }),
        () => setState({ kind: "converting", name: file.name }),
      );
      if (status === 201 && body?.document) {
        toast.success(`Imported “${body.document.title}”`);
        setState({ kind: "idle" });
        router.push(`/docs/${body.document.id}`);
        return;
      }
      if (status === 401) return fail(file.name, "Your session expired. Sign in again.");
      fail(file.name, body?.error?.message ?? "The server could not import this file.");
    } catch (e) {
      fail(file.name, e instanceof Error ? e.message : "Upload failed");
    }
  }

  const inputProps = {
    ref: inputRef,
    type: "file" as const,
    accept: ".txt,text/plain",
    hidden: true,
    "aria-label": "Choose a .txt file to import",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow picking the same file again
      if (file) void onFile(file);
    },
  };

  return {
    state,
    busy,
    inputProps,
    openPicker: () => inputRef.current?.click(),
    dismiss: () => setState({ kind: "idle" }),
  };
}

export function ImportButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={busy} title={IMPORT_HELP}>
      {busy ? <Loader2Icon className="animate-spin" /> : <FileUpIcon />} {busy ? "Importing…" : "Import .txt"}
    </Button>
  );
}

export function ImportStatus({ state, dismiss }: { state: ImportState; dismiss: () => void }) {
  if (state.kind === "idle") return null;
  if (state.kind === "error") {
    return (
      <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p className="min-w-0 flex-1">
          <strong className="break-all">{state.name}</strong> could not be imported: {state.message}{" "}
          <span className="text-muted-foreground">{IMPORT_HELP}</span>
        </p>
        <button onClick={dismiss} aria-label="Dismiss" className="rounded p-0.5 hover:bg-muted">
          <XIcon className="size-4" />
        </button>
      </div>
    );
  }
  const percent = state.kind === "uploading" ? state.percent : 100;
  return (
    <div role="status" aria-live="polite" className="mt-3 rounded-md border px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          {state.kind === "uploading" ? "Uploading" : "Converting"} <strong>{state.name}</strong>…
        </span>
        <span className="tabular-nums text-muted-foreground">{state.kind === "uploading" ? `${percent}%` : "Almost done"}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
