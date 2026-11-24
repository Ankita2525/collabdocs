import { EyeIcon, PencilIcon, ShieldCheckIcon } from "lucide-react";
import type { Access } from "@/lib/access";
import { cn } from "@/lib/utils";

const STYLES: Record<Access, { label: string; className: string; Icon: typeof EyeIcon }> = {
  owner: { label: "Owner", className: "bg-primary/10 text-primary ring-primary/20", Icon: ShieldCheckIcon },
  editor: { label: "Can edit", className: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: PencilIcon },
  viewer: { label: "View only", className: "bg-slate-100 text-slate-700 ring-slate-200", Icon: EyeIcon },
};

/** One consistent permission indicator used on the dashboard, in the editor header and in the share dialog. */
export function RoleBadge({ role, className }: { role: Access; className?: string }) {
  const { label, className: tone, Icon } = STYLES[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden /> {label}
    </span>
  );
}
