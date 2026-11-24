import { describe, expect, it } from "vitest";
import { stableStringify } from "@/lib/json";

describe("stableStringify", () => {
  it("ignores key order at every depth", () => {
    const a = { type: "doc", content: [{ type: "heading", attrs: { level: 1, id: null }, content: [] }] };
    const b = { content: [{ content: [], attrs: { id: null, level: 1 }, type: "heading" }], type: "doc" };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
  it("keeps array order significant and distinguishes different values", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
    expect(stableStringify({ a: 1 })).not.toBe(stableStringify({ a: 2 }));
    expect(stableStringify({ a: null })).not.toBe(stableStringify({}));
  });
});
