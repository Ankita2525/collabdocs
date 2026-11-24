import { describe, it, expect } from "vitest";
import { createDocumentSchema, loginSchema, patchDocumentSchema, titleSchema } from "@/lib/schemas";

describe("titleSchema", () => {
  it("trims whitespace", () => {
    expect(titleSchema.parse("  Hello  ")).toBe("Hello");
  });
  it("rejects empty and whitespace-only titles", () => {
    expect(titleSchema.safeParse("").success).toBe(false);
    expect(titleSchema.safeParse("   ").success).toBe(false);
  });
  it("accepts 200 characters and rejects 201", () => {
    expect(titleSchema.safeParse("a".repeat(200)).success).toBe(true);
    expect(titleSchema.safeParse("a".repeat(201)).success).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(titleSchema.safeParse(42).success).toBe(false);
    expect(titleSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("createDocumentSchema", () => {
  it("allows an omitted title", () => {
    expect(createDocumentSchema.safeParse({}).success).toBe(true);
  });
  it("validates a provided title", () => {
    expect(createDocumentSchema.safeParse({ title: " " }).success).toBe(false);
  });
});

describe("patchDocumentSchema", () => {
  it("requires something to update", () => {
    expect(patchDocumentSchema.safeParse({}).success).toBe(false);
  });
  it("accepts a valid title", () => {
    expect(patchDocumentSchema.parse({ title: " New " }).title).toBe("New");
  });
  it("requires baseVersion with content", () => {
    expect(patchDocumentSchema.safeParse({ content: { type: "doc" } }).success).toBe(false);
    expect(patchDocumentSchema.safeParse({ content: { type: "doc" }, baseVersion: 1 }).success).toBe(true);
  });
  it("rejects bad baseVersion values", () => {
    for (const baseVersion of [0, -1, 1.5, "1", null]) {
      expect(patchDocumentSchema.safeParse({ content: { type: "doc" }, baseVersion }).success).toBe(false);
    }
  });
  it("rejects title and content together", () => {
    expect(patchDocumentSchema.safeParse({ title: "x", content: { type: "doc" }, baseVersion: 1 }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a uuid", () => {
    expect(loginSchema.safeParse({ userId: "nope" }).success).toBe(false);
    expect(loginSchema.safeParse({ userId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
  });
});
