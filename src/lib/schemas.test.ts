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
    expect(patchDocumentSchema.parse({ title: " New " })).toEqual({ title: "New" });
  });
});

describe("loginSchema", () => {
  it("requires a uuid", () => {
    expect(loginSchema.safeParse({ userId: "nope" }).success).toBe(false);
    expect(loginSchema.safeParse({ userId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
  });
});
