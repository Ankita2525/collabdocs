"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  BoldIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolButton({ label, active, disabled, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus (and the selection) in the editor when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors",
        "hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;

export function Toolbar({ editor, disabled }: { editor: Editor | null; disabled: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
      h1: e?.isActive("heading", { level: 1 }) ?? false,
      h2: e?.isActive("heading", { level: 2 }) ?? false,
      h3: e?.isActive("heading", { level: 3 }) ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });
  const off = disabled || !editor;
  const run = () => editor!.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
      <ToolButton label="Bold (Ctrl+B)" active={s?.bold} disabled={off} onClick={() => run().toggleBold().run()}>
        <BoldIcon className="size-4" />
      </ToolButton>
      <ToolButton label="Italic (Ctrl+I)" active={s?.italic} disabled={off} onClick={() => run().toggleItalic().run()}>
        <ItalicIcon className="size-4" />
      </ToolButton>
      <ToolButton
        label="Underline (Ctrl+U)"
        active={s?.underline}
        disabled={off}
        onClick={() => run().toggleUnderline().run()}
      >
        <UnderlineIcon className="size-4" />
      </ToolButton>
      <Divider />
      <ToolButton
        label="Heading 1"
        active={s?.h1}
        disabled={off}
        onClick={() => run().toggleHeading({ level: 1 }).run()}
      >
        <Heading1Icon className="size-4" />
      </ToolButton>
      <ToolButton
        label="Heading 2"
        active={s?.h2}
        disabled={off}
        onClick={() => run().toggleHeading({ level: 2 }).run()}
      >
        <Heading2Icon className="size-4" />
      </ToolButton>
      <ToolButton
        label="Heading 3"
        active={s?.h3}
        disabled={off}
        onClick={() => run().toggleHeading({ level: 3 }).run()}
      >
        <Heading3Icon className="size-4" />
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" active={s?.bullet} disabled={off} onClick={() => run().toggleBulletList().run()}>
        <ListIcon className="size-4" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={s?.ordered}
        disabled={off}
        onClick={() => run().toggleOrderedList().run()}
      >
        <ListOrderedIcon className="size-4" />
      </ToolButton>
      <Divider />
      <ToolButton label="Undo (Ctrl+Z)" disabled={off || !s?.canUndo} onClick={() => run().undo().run()}>
        <Undo2Icon className="size-4" />
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Shift+Z)" disabled={off || !s?.canRedo} onClick={() => run().redo().run()}>
        <Redo2Icon className="size-4" />
      </ToolButton>
    </div>
  );
}
