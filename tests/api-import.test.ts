import { beforeEach, describe, expect, it, vi } from "vitest";
import { errors } from "@/lib/errors";
import { setRepoForTests, type User } from "@/lib/repo";
import { createFakeRepo } from "./fake-repo";

let currentUser: User | null = null;
vi.mock("@/lib/session", () => ({
  requireUser: async () => {
    if (!currentUser) throw errors.unauthenticated();
    return currentUser;
  },
}));

import { POST as IMPORT } from "@/app/api/documents/import/route";
import { GET as GET_DOC } from "@/app/api/documents/[id]/route";
import { GET as LIST } from "@/app/api/documents/route";

const alice: User = { id: "11111111-1111-4111-8111-111111111111", email: "a@x", name: "Alice" };
const bob: User = { id: "22222222-2222-4222-8222-222222222222", email: "b@x", name: "Bob" };

let fake: ReturnType<typeof createFakeRepo>;

const upload = (name: string, body: BlobPart, type = "text/plain", field = "file") => {
  const form = new FormData();
  form.set(field, new File([body], name, { type }));
  return IMPORT(new Request("http://t/api/documents/import", { method: "POST", body: form }));
};

beforeEach(() => {
  fake = createFakeRepo([alice, bob]);
  setRepoForTests(fake.repo);
  currentUser = alice;
});

describe("POST /api/documents/import", () => {
  it("rejects unauthenticated uploads (401) and creates nothing", async () => {
    currentUser = null;
    expect((await upload("a.txt", "hi")).status).toBe(401);
    currentUser = alice;
    expect((await (await LIST()).json()).owned).toEqual([]);
  });

  it("creates a new document owned by the current user, titled from the filename", async () => {
    const res = await upload("Trip plan.txt", "Day 1\nArrive 😀\n\nDay 2\nCafé");
    expect(res.status).toBe(201);
    const { document } = await res.json();
    expect(document).toMatchObject({ title: "Trip plan", ownerId: alice.id, ownerName: "Alice", version: 1 });
    const list = await (await LIST()).json();
    expect(list.owned.map((d: { id: string }) => d.id)).toEqual([document.id]);
  });

  it("stores paragraphs, hard breaks and Unicode, readable back as the owner", async () => {
    const text = "Alpha line\nBeta line\n\nГамма — 日本語 😀";
    const { document } = await (await upload("u.txt", text)).json();
    const res = await GET_DOC(new Request("http://t"), { params: Promise.resolve({ id: document.id }) });
    const body = await res.json();
    expect(body.role).toBe("owner");
    expect(body.document.content.content).toHaveLength(2);
    expect(JSON.stringify(body.document.content)).toContain("hardBreak");
    expect(JSON.stringify(body.document.content)).toContain("Гамма — 日本語 😀");
  });

  it("ignores any owner supplied in the request: ownership comes from the session", async () => {
    const form = new FormData();
    form.set("file", new File(["x"], "mine.txt", { type: "text/plain" }));
    form.set("ownerId", bob.id);
    const res = await IMPORT(new Request("http://t", { method: "POST", body: form }));
    expect((await res.json()).document.ownerId).toBe(alice.id);
  });

  it("does not show the imported document to another user", async () => {
    const { document } = await (await upload("private.txt", "secret")).json();
    currentUser = bob;
    const res = await GET_DOC(new Request("http://t"), { params: Promise.resolve({ id: document.id }) });
    expect(res.status).toBe(404);
  });

  const rejects: [string, () => Promise<Response>, number][] = [
    ["wrong extension (.pdf)", () => upload("a.pdf", "x", "application/pdf"), 415],
    ["no extension", () => upload("README", "x"), 415],
    ["text/html content type with .txt name", () => upload("a.txt", "x", "text/html"), 415],
    ["empty file", () => upload("empty.txt", ""), 400],
    ["whitespace-only file", () => upload("blank.txt", "  \n\n\t"), 400],
    ["binary content in a .txt", () => upload("bin.txt", new Uint8Array([0x25, 0x50, 0x00, 0xff])), 400],
    ["invalid UTF-8", () => upload("latin1.txt", new Uint8Array([0x63, 0x61, 0x66, 0xe9])), 400],
    ["over 1 MB", () => upload("big.txt", "a".repeat(1_000_001)), 413],
    ["missing file field", () => upload("a.txt", "x", "text/plain", "wrongfield"), 400],
  ];
  for (const [name, run, status] of rejects) {
    it(`rejects ${name} with ${status} and creates no document`, async () => {
      const res = await run();
      expect(res.status).toBe(status);
      expect((await res.json()).error.message).toBeTruthy();
      expect((await (await LIST()).json()).owned).toEqual([]);
    });
  }

  it("rejects a non-multipart body with 400", async () => {
    const res = await IMPORT(
      new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an oversized request early using content-length (413)", async () => {
    const res = await IMPORT(
      new Request("http://t", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=x", "content-length": "5000000" },
        body: "--x--",
      }),
    );
    expect(res.status).toBe(413);
  });
});
