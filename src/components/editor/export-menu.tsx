"use client";

import type { Editor } from "@tiptap/react";
import { DownloadIcon, FileDownIcon, PrinterIcon } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { docToMarkdown, markdownFilename } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * Export what is currently on screen (including unsaved edits). Everything happens in the browser from
 * data the user is already allowed to read, so there is no new endpoint and no new server-side access path.
 */
export function ExportMenu({ editor, title, disabled }: { editor: Editor | null; title: string; disabled: boolean }) {
  const off = disabled || !editor;

  function downloadMarkdown() {
    if (!editor) return;
    try {
      const markdown = docToMarkdown(editor.getJSON());
      const filename = markdownFilename(title);
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(markdown ? `Downloaded ${filename}` : `Downloaded ${filename} (the document is empty)`);
    } catch {
      toast.error("Could not create the Markdown file. Please try again.");
    }
  }

  function printDocument() {
    // Chrome and Safari use document.title as the default PDF file name.
    const previous = document.title;
    document.title = title;
    window.addEventListener("afterprint", () => (document.title = previous), { once: true });
    // Give the menu time to close so it is not in the print output.
    setTimeout(() => window.print(), 100);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={off}
        aria-label="Export document"
        title={disabled ? "Export is unavailable: you no longer have access to this document" : "Export document"}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "print:hidden")}
      >
        <DownloadIcon /> Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={off} onClick={downloadMarkdown}>
          <FileDownIcon /> Download Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem disabled={off} onClick={printDocument}>
          <PrinterIcon /> Print / Save as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
