import { describe, it, expect } from "vitest";
import { MAX_CONTENT_BYTES, validateContent } from "@/lib/content";

const p = (text: string, marks?: { type: string }[]) => ({
  type: "paragraph",
  content: [{ type: "text", text, ...(marks ? { marks } : {}) }],
});
const doc = (...content: unknown[]) => ({ type: "doc", content });

describe("validateContent: accepted content", () => {
  it("accepts an empty paragraph document", () => {
    expect(validateContent(doc({ type: "paragraph" })).ok).toBe(true);
  });
  it("accepts bold, italic and underline marks (also combined)", () => {
    const r = validateContent(
      doc(p("a", [{ type: "bold" }]), p("b", [{ type: "italic" }, { type: "underline" }, { type: "bold" }])),
    );
    expect(r.ok).toBe(true);
  });
  it("accepts headings 1 to 3", () => {
    for (const level of [1, 2, 3]) {
      expect(validateContent(doc({ type: "heading", attrs: { level }, content: [{ type: "text", text: "H" }] })).ok).toBe(
        true,
      );
    }
  });
  it("accepts bullet and ordered lists with nested content", () => {
    const item = (t: string) => ({ type: "listItem", content: [p(t)] });
    const r = validateContent(
      doc(
        { type: "bulletList", content: [item("x"), item("y")] },
        { type: "orderedList", attrs: { start: 1, type: null }, content: [item("1"), item("2")] },
      ),
    );
    expect(r.ok).toBe(true);
  });
  it("accepts hard breaks", () => {
    expect(
      validateContent(doc({ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }] })).ok,
    ).toBe(true);
  });
  it("round-trips formatting without changing it", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      p("bold", [{ type: "bold" }]),
    );
    const r = validateContent(input);
    expect(r.ok && r.doc).toEqual(input);
  });
  it("drops unknown attributes from the stored document", () => {
    const r = validateContent(doc({ type: "paragraph", attrs: { evil: "x" }, content: [{ type: "text", text: "t" }] }));
    expect(r.ok && JSON.stringify(r.doc)).not.toContain("evil");
  });
});

describe("validateContent: rejected content", () => {
  it("rejects non-objects and wrong roots", () => {
    for (const v of [null, undefined, "x", 5, [], { type: "paragraph" }, { type: "doc", content: "no" }]) {
      expect(validateContent(v).ok).toBe(false);
    }
  });
  it("rejects heading levels outside 1-3", () => {
    expect(validateContent(doc({ type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "H" }] })).ok).toBe(
      false,
    );
  });
  it("rejects non-numeric or missing heading levels and bad list attributes", () => {
    for (const level of ["2", 0, 1.5, null]) {
      expect(validateContent(doc({ type: "heading", attrs: { level }, content: [{ type: "text", text: "H" }] })).ok).toBe(
        false,
      );
    }
    const li = { type: "listItem", content: [p("x")] };
    expect(validateContent(doc({ type: "orderedList", attrs: { start: -3 }, content: [li] })).ok).toBe(false);
    expect(validateContent(doc({ type: "orderedList", attrs: { start: 1, type: "javascript:" }, content: [li] })).ok).toBe(
      false,
    );
  });
  it("rejects unsupported node types", () => {
    for (const type of ["codeBlock", "blockquote", "horizontalRule", "image", "script", "table"]) {
      expect(validateContent(doc({ type, content: [p("x")] })).ok).toBe(false);
    }
  });
  it("rejects unsupported marks", () => {
    for (const type of ["link", "strike", "code", "highlight"]) {
      expect(validateContent(doc(p("x", [{ type }]))).ok).toBe(false);
    }
  });
  it("rejects invalid nesting (listItem directly in doc, text directly in doc)", () => {
    expect(validateContent(doc({ type: "listItem", content: [p("x")] })).ok).toBe(false);
    expect(validateContent(doc({ type: "text", text: "loose" })).ok).toBe(false);
  });
  it("rejects empty text nodes", () => {
    expect(validateContent(doc(p(""))).ok).toBe(false);
  });
  it("rejects documents over the size limit", () => {
    const big = doc(p("a".repeat(MAX_CONTENT_BYTES)));
    const r = validateContent(big);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/too large/i);
  });
});
