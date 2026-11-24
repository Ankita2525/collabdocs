import { errors } from "@/lib/errors";
import { validateContent, type TiptapDoc } from "@/lib/content";
import { DEFAULT_IMPORT_TITLE, titleSchema } from "@/lib/schemas";
import { MAX_IMPORT_BYTES, SUPPORTED_EXTENSION } from "@/lib/import-limits";

export { MAX_IMPORT_BYTES, SUPPORTED_EXTENSION };
const ALLOWED_MIME = new Set(["", "text/plain", "application/octet-stream"]);

// C0 control characters except tab and newline, plus DEL.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strict UTF-8 decode. Rejects binary data (NUL bytes) and invalid UTF-8. */
export function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.includes(0)) throw errors.badRequest("This looks like a binary file, not plain text");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw errors.badRequest("The file is not valid UTF-8 text. Save it as UTF-8 and try again");
  }
}

/**
 * Plain text -> Tiptap document.
 * - A blank (or whitespace-only) line separates paragraphs.
 * - A single line break inside a paragraph becomes a hard break (line breaks are preserved).
 * - CRLF/CR are normalised, a BOM and control characters are dropped, Unicode is left untouched,
 *   leading indentation is kept (the editor uses pre-wrap), trailing spaces are trimmed.
 */
export function parsePlainText(raw: string): TiptapDoc {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "");

  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line.trimEnd());
    }
  }
  if (current.length) blocks.push(current);

  if (blocks.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };

  return {
    type: "doc",
    content: blocks.map((lines) => ({
      type: "paragraph",
      content: lines.flatMap((line, i) =>
        i === 0 ? [{ type: "text", text: line }] : [{ type: "hardBreak" }, { type: "text", text: line }],
      ),
    })),
  };
}

/** "C:\\docs\\My_Notes.TXT" -> "My_Notes". Falls back to a default; always a valid title. */
export function titleFromFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const withoutExt = base.replace(/\.txt$/i, "");
  const cleaned = withoutExt.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim().slice(0, 200).trim();
  return titleSchema.safeParse(cleaned).success ? cleaned : DEFAULT_IMPORT_TITLE;
}

export type ImportInput = { name: string; type: string; bytes: Uint8Array };

/** Validates an uploaded file and converts it. Throws ApiError with a user-facing message. */
export function prepareImport(file: ImportInput): { title: string; content: TiptapDoc } {
  if (!file.name.toLowerCase().endsWith(SUPPORTED_EXTENSION)) {
    throw errors.unsupportedType("Only .txt files are supported");
  }
  const mime = file.type.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw errors.unsupportedType("Only plain-text (.txt) files are supported");
  }
  if (file.bytes.byteLength === 0) throw errors.badRequest("The file is empty");
  if (file.bytes.byteLength > MAX_IMPORT_BYTES) throw errors.tooLarge("The file is larger than the 1 MB limit");

  const text = decodeUtf8(file.bytes);
  if (text.replace(CONTROL_CHARS, "").trim() === "") throw errors.badRequest("The file has no text content");

  const content = parsePlainText(text);
  const checked = validateContent(content);
  if (!checked.ok) {
    throw checked.message.toLowerCase().includes("too large")
      ? errors.tooLarge("This file has too many lines to import as one document")
      : errors.badRequest("The file could not be converted");
  }
  return { title: titleFromFilename(file.name), content: checked.doc };
}


