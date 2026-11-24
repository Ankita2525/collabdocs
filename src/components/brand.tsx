import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The CollabDocs mark: a single rounded tile with a document glyph. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)}
    >
      <FileTextIcon className="size-[18px]" />
    </span>
  );
}

export function Brand({ href = "/", size = "md" }: { href?: string; size?: "md" | "lg" }) {
  return (
    <Link
      href={href}
      aria-label="CollabDocs home"
      className="inline-flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <LogoMark className={size === "lg" ? "size-10 rounded-xl" : undefined} />
      <span className={cn("font-semibold tracking-tight", size === "lg" ? "text-2xl" : "text-lg")}>CollabDocs</span>
    </Link>
  );
}
