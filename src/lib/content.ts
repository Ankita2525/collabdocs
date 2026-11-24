import { getSchema } from "@tiptap/core";
import { z } from "zod";
import { HEADING_LEVELS, editorExtensions } from "@/lib/editor-extensions";

export const MAX_CONTENT_BYTES = 1_000_000;

export type TiptapDoc = { type: "doc"; content?: unknown[] };

// Built once per server instance. Pure ProseMirror, no DOM needed.
const schema = getSchema(editorExtensions);

const envelope = z.object({ type: z.literal("doc") }).loose();

const LIST_TYPES = new Set(["1", "a", "A", "i", "I"]);

/** The schema checks structure but not attribute values, so check them here. */
function attributesValid(node: ReturnType<typeof schema.nodeFromJSON>): boolean {
  let ok = true;
  node.descendants((child) => {
    if (child.type.name === "heading") {
      if (!(HEADING_LEVELS as readonly number[]).includes(child.attrs.level)) ok = false;
    }
    if (child.type.name === "orderedList") {
      const { start, type } = child.attrs;
      if (!Number.isInteger(start) || start < 1 || start > 1_000_000) ok = false;
      if (type != null && !LIST_TYPES.has(type)) ok = false;
    }
    return ok;
  });
  return ok;
}

export type ContentResult = { ok: true; doc: TiptapDoc } | { ok: false; message: string };

/**
 * Validates arbitrary JSON against the real editor schema and returns the
 * normalized document (unknown attributes dropped). Rejects unknown node/mark
 * types, invalid nesting, empty text nodes and oversized payloads.
 */
export function validateContent(input: unknown): ContentResult {
  if (!envelope.safeParse(input).success) {
    return { ok: false, message: "Content must be a document object" };
  }
  let size: number;
  try {
    size = Buffer.byteLength(JSON.stringify(input));
  } catch {
    return { ok: false, message: "Content is not valid JSON" };
  }
  if (size > MAX_CONTENT_BYTES) {
    return { ok: false, message: "Document is too large" };
  }
  try {
    const node = schema.nodeFromJSON(input);
    node.check();
    if (!attributesValid(node)) {
      return { ok: false, message: "Content contains unsupported or invalid formatting" };
    }
    return { ok: true, doc: node.toJSON() as TiptapDoc };
  } catch {
    return { ok: false, message: "Content contains unsupported or invalid formatting" };
  }
}
