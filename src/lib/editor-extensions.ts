import StarterKit from "@tiptap/starter-kit";

/**
 * Single source of truth for what a document may contain.
 * Used by the browser editor AND by server-side validation, so stored content
 * can never contain nodes/marks the editor does not support.
 * Supported: paragraph, heading 1-3, bullet/ordered lists, hard break; bold, italic, underline.
 */
export const HEADING_LEVELS = [1, 2, 3] as const;

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [...HEADING_LEVELS] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    link: false,
    trailingNode: false,
    dropcursor: false,
    gapcursor: false,
  }),
];
