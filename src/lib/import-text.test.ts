import { describe, expect, it } from "vitest";
import { validateContent, type TiptapDoc } from "@/lib/content";
import { MAX_IMPORT_BYTES, decodeUtf8, parsePlainText, prepareImport, titleFromFilename } from "@/lib/import-text";

const enc = (s: string) => new TextEncoder().encode(s);
const file = (name: string, body: string | Uint8Array, type = "text/plain") => ({
  name,
  type,
  bytes: typeof body === "string" ? enc(body) : body,
});

/** Rebuilds plain text from a converted document: paragraphs joined by a blank line, hard breaks as \n. */
export function docToText(doc: TiptapDoc): string {
  return (doc.content as { content?: { type: string; text?: string }[] }[])
    .map((p) => (p.content ?? []).map((n) => (n.type === "hardBreak" ? "\n" : (n.text ?? ""))).join(""))
    .join("\n\n");
}

describe("parsePlainText", () => {
  it("turns blank-line separated blocks into paragraphs", () => {
    const doc = parsePlainText("First paragraph.\n\nSecond paragraph.\n\n\n\nThird.");
    expect(doc.content).toHaveLength(3);
    expect(docToText(doc)).toBe("First paragraph.\n\nSecond paragraph.\n\nThird.");
  });
  it("keeps single line breaks as hard breaks inside a paragraph", () => {
    const doc = parsePlainText("line one\nline two\nline three");
    expect(doc.content).toHaveLength(1);
    const types = (doc.content![0] as { content: { type: string }[] }).content.map((n) => n.type);
    expect(types).toEqual(["text", "hardBreak", "text", "hardBreak", "text"]);
    expect(docToText(doc)).toBe("line one\nline two\nline three");
  });
  it("normalises CRLF and CR line endings", () => {
    expect(docToText(parsePlainText("a\r\nb\r\n\r\nc\rd"))).toBe("a\nb\n\nc\nd");
  });
  it("treats whitespace-only lines as paragraph separators and ignores leading/trailing blank lines", () => {
    expect(docToText(parsePlainText("\n\n  \nalpha\n \t \nbeta\n\n\n"))).toBe("alpha\n\nbeta");
  });
  it("strips a BOM and control characters but keeps tabs and indentation", () => {
    const doc = parsePlainText("\uFEFFa\u0007b\u000B\n\tindented\n    four");
    expect(docToText(doc)).toBe("ab\n\tindented\n    four");
  });
  it("trims trailing spaces on lines", () => {
    expect(docToText(parsePlainText("trail   \nnext\t "))).toBe("trail\nnext");
  });
  it("preserves Unicode exactly (accents, CJK, emoji, RTL, combining marks)", () => {
    const text = "Café naïve – “quotes”\n日本語のテキスト 😀🎉\n\nمرحبا بالعالم\ne\u0301 ñ ß ₹ Ω";
    expect(docToText(parsePlainText(text))).toBe(text);
  });
  it("produces content that passes the editor-schema validator", () => {
    const doc = parsePlainText("one\ntwo\n\nthree 😀");
    expect(validateContent(doc).ok).toBe(true);
  });
  it("returns an empty paragraph for empty input", () => {
    expect(parsePlainText("  \n\n").content).toEqual([{ type: "paragraph" }]);
  });
  it("does not interpret markup: HTML and markdown stay literal text", () => {
    const text = "<script>alert(1)</script>\n# not a heading\n- not a list";
    expect(docToText(parsePlainText(text))).toBe(text);
    expect(JSON.stringify(parsePlainText(text))).not.toContain('"heading"');
  });
});

describe("decodeUtf8", () => {
  it("decodes valid UTF-8", () => {
    expect(decodeUtf8(enc("héllo 😀"))).toBe("héllo 😀");
  });
  it("rejects invalid UTF-8 (e.g. Latin-1 bytes)", () => {
    expect(() => decodeUtf8(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toThrow(/UTF-8/);
  });
  it("rejects binary data containing NUL bytes", () => {
    expect(() => decodeUtf8(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]))).toThrow(/binary/);
  });
});

describe("titleFromFilename", () => {
  it("strips the .txt extension (case-insensitive) and keeps the name", () => {
    expect(titleFromFilename("Meeting notes.txt")).toBe("Meeting notes");
    expect(titleFromFilename("REPORT.TXT")).toBe("REPORT");
    expect(titleFromFilename("my_file-v2.final.txt")).toBe("my_file-v2.final");
  });
  it("drops any path, collapses whitespace and handles Unicode", () => {
    expect(titleFromFilename("C:\\Users\\me\\Docs\\Plan.txt")).toBe("Plan");
    expect(titleFromFilename("/tmp/a/b/Spaced   out  name.txt")).toBe("Spaced out name");
    expect(titleFromFilename("日本語メモ.txt")).toBe("日本語メモ");
  });
  it("falls back for empty names and truncates long ones to 200 characters", () => {
    expect(titleFromFilename(".txt")).toBe("Imported document");
    expect(titleFromFilename("   .txt")).toBe("Imported document");
    expect(titleFromFilename("a".repeat(300) + ".txt")).toHaveLength(200);
  });
});

describe("prepareImport", () => {
  it("converts a valid file and derives the title", () => {
    const r = prepareImport(file("Notes.txt", "hello\nworld\n\nbye"));
    expect(r.title).toBe("Notes");
    expect(docToText(r.content)).toBe("hello\nworld\n\nbye");
  });
  it("accepts an empty or generic mime type (some browsers send none)", () => {
    expect(() => prepareImport(file("a.txt", "x", ""))).not.toThrow();
    expect(() => prepareImport(file("a.txt", "x", "application/octet-stream"))).not.toThrow();
    expect(() => prepareImport(file("a.txt", "x", "text/plain; charset=utf-8"))).not.toThrow();
  });
  it("rejects other extensions with 415", () => {
    for (const name of ["a.pdf", "a.docx", "a.md", "a", "a.txt.exe", "a.txt.pdf"]) {
      expect(() => prepareImport(file(name, "x"))).toThrowError(expect.objectContaining({ status: 415 }));
    }
  });
  it("rejects a .txt extension with a non-text mime type with 415", () => {
    expect(() => prepareImport(file("a.txt", "x", "application/pdf"))).toThrowError(
      expect.objectContaining({ status: 415 }),
    );
    expect(() => prepareImport(file("a.txt", "x", "image/png"))).toThrowError(expect.objectContaining({ status: 415 }));
  });
  it("rejects empty and whitespace-only content with 400", () => {
    for (const body of ["", "   \n\n\t  ", "\uFEFF\n", "\u0001\u0002"]) {
      expect(() => prepareImport(file("a.txt", body))).toThrowError(expect.objectContaining({ status: 400 }));
    }
  });
  it("rejects files over 1 MB with 413 and accepts exactly the limit", () => {
    expect(() => prepareImport(file("a.txt", "a".repeat(MAX_IMPORT_BYTES + 1)))).toThrowError(
      expect.objectContaining({ status: 413 }),
    );
    expect(() => prepareImport(file("a.txt", "a".repeat(MAX_IMPORT_BYTES)))).not.toThrow();
  });
  it("rejects a binary file renamed to .txt with 400", () => {
    const pdfLike = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0xff, 0xfe]);
    expect(() => prepareImport(file("fake.txt", pdfLike))).toThrowError(expect.objectContaining({ status: 400 }));
  });
  it("rejects a file whose line structure would make the document too large (413) instead of crashing", () => {
    const manyLines = "x\n".repeat(MAX_IMPORT_BYTES / 2); // ~500k lines, 1 MB
    expect(() => prepareImport(file("lines.txt", manyLines))).toThrowError(expect.objectContaining({ status: 413 }));
  });
});
