import { cn } from "@/lib/utils";

// Solid -700 shades: white initials keep at least 4.5:1 contrast.
const PALETTE = [
  "bg-blue-700",
  "bg-emerald-700",
  "bg-violet-700",
  "bg-rose-700",
  "bg-teal-700",
  "bg-orange-700",
  "bg-fuchsia-700",
  "bg-cyan-700",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Decorative initials avatar (the name is always shown next to it, so it is hidden from assistive tech). */
export function Avatar({ name, id, size = "md", className }: { name: string; id: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        PALETTE[hash(id) % PALETTE.length],
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-12 text-base",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
