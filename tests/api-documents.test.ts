import { beforeEach, describe, expect, it, vi } from "vitest";
import { errors } from "@/lib/errors";
import { setRepoForTests, type User } from "@/lib/repo";
import { createFakeRepo } from "./fake-repo";

// Replace only the cookie/session lookup; the route handlers, access checks, validation and
// error mapping under test are the real code.
let currentUser: User | null = null;
vi.mock("@/lib/session", () => ({
  requireUser: async () => {
    if (!currentUser) throw errors.unauthenticated();
    return currentUser;
  },
}));

import { DELETE, GET, PATCH } from "@/app/api/documents/[id]/route";
import { GET as LIST, POST as CREATE } from "@/app/api/documents/route";

const alice: User = { id: "11111111-1111-4111-8111-111111111111", email: "a@x", name: "Alice" };
const bob: User = { id: "22222222-2222-4222-8222-222222222222", email: "b@x", name: "Bob" };
const carol: User = { id: "33333333-3333-4333-8333-333333333333", email: "c@x", name: "Carol" };

const goodContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Hi" }] },
    { type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "bold" }] }] },
  ],
};

let fake: ReturnType<typeof createFakeRepo>;
let docId: string;

const req = (method: string, body?: unknown) =>
  new Request("http://test/api", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown, id = docId) => PATCH(req("PATCH", body), ctx(id));
const get = (id = docId) => GET(req("GET"), ctx(id));
const del = (id = docId) => DELETE(req("DELETE"), ctx(id));
const as = (u: User | null) => {
  currentUser = u;
};

beforeEach(async () => {
  fake = createFakeRepo([alice, bob, carol]);
  setRepoForTests(fake.repo);
  as(alice);
  const res = await CREATE(req("POST", { title: "Plan" }));
  docId = (await res.json()).document.id;
  fake.addShare(docId, bob.id, "viewer");
  fake.addShare(docId, carol.id, "editor");
});

describe("authentication", () => {
  it("rejects every operation without a session (401)", async () => {
    as(null);
    expect((await LIST()).status).toBe(401);
    expect((await CREATE(req("POST", {}))).status).toBe(401);
    expect((await get()).status).toBe(401);
    expect((await patch({ title: "x" })).status).toBe(401);
    expect((await del()).status).toBe(401);
  });
});

describe("a user with no access (stranger)", () => {
  const stranger: User = { id: "44444444-4444-4444-8444-444444444444", email: "d@x", name: "Dan" };
  beforeEach(() => {
    fake = createFakeRepo([alice, bob, carol, stranger]);
    setRepoForTests(fake.repo);
  });
  it("gets 404 (not 403) for read, rename, content save and delete", async () => {
    as(alice);
    const id = (await (await CREATE(req("POST", {}))).json()).document.id;
    as(stranger);
    expect((await get(id)).status).toBe(404);
    expect((await patch({ title: "x" }, id)).status).toBe(404);
    expect((await patch({ content: goodContent, baseVersion: 1 }, id)).status).toBe(404);
    expect((await del(id)).status).toBe(404);
    expect(fake.raw(id)?.title).toBe("Untitled document");
    expect(fake.raw(id)?.version).toBe(1);
  });
  it("sees only their own documents in the list", async () => {
    as(stranger);
    expect(await (await LIST()).json()).toEqual({ owned: [], shared: [] });
  });
});

describe("viewer", () => {
  beforeEach(() => as(bob));
  it("can read and sees their role", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("viewer");
  });
  it("cannot save content (403) and the document is unchanged", async () => {
    const res = await patch({ content: goodContent, baseVersion: 1 });
    expect(res.status).toBe(403);
    expect(fake.raw(docId)?.version).toBe(1);
  });
  it("cannot rename or delete (403)", async () => {
    expect((await patch({ title: "hacked" })).status).toBe(403);
    expect((await del()).status).toBe(403);
    expect(fake.raw(docId)?.title).toBe("Plan");
  });
  it("gets 403 (not 400) even when the content is invalid: authorization comes first", async () => {
    expect((await patch({ content: { type: "nope" }, baseVersion: 1 })).status).toBe(403);
  });
  it("sees the document in the shared list with role and owner", async () => {
    const list = await (await LIST()).json();
    expect(list.owned).toEqual([]);
    expect(list.shared).toHaveLength(1);
    expect(list.shared[0]).toMatchObject({ id: docId, role: "viewer", ownerName: "Alice" });
  });
});

describe("editor", () => {
  beforeEach(() => as(carol));
  it("can save content (200) and the version increments", async () => {
    const res = await patch({ content: goodContent, baseVersion: 1 });
    expect(res.status).toBe(200);
    expect((await res.json()).document.version).toBe(2);
    expect(fake.raw(docId)?.content).toEqual(goodContent);
  });
  it("cannot rename or delete (403)", async () => {
    expect((await patch({ title: "x" })).status).toBe(403);
    expect((await del()).status).toBe(403);
    expect(fake.raw(docId)).toBeDefined();
  });
});

describe("owner", () => {
  it("can rename (title validated and trimmed)", async () => {
    expect((await patch({ title: "  New name  " })).status).toBe(200);
    expect(fake.raw(docId)?.title).toBe("New name");
    expect((await patch({ title: "   " })).status).toBe(400);
  });
  it("can save content and then reads the same formatting back", async () => {
    expect((await patch({ content: goodContent, baseVersion: 1 })).status).toBe(200);
    const body = await (await get()).json();
    expect(body.role).toBe("owner");
    expect(body.document.content).toEqual(goodContent);
    expect(body.document.version).toBe(2);
  });
  it("can delete, after which the document is gone (404)", async () => {
    expect((await del()).status).toBe(200);
    expect((await get()).status).toBe(404);
  });
});

describe("stale writes (optimistic concurrency)", () => {
  it("second save with the same baseVersion gets 409 and does not overwrite", async () => {
    as(alice);
    expect((await patch({ content: goodContent, baseVersion: 1 })).status).toBe(200);
    const other = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "late" }] }] };
    as(carol);
    const res = await patch({ content: other, baseVersion: 1 });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("conflict");
    expect(fake.raw(docId)?.content).toEqual(goodContent);
    expect(fake.raw(docId)?.version).toBe(2);
  });
  it("a save with the up-to-date version succeeds", async () => {
    as(alice);
    await patch({ content: goodContent, baseVersion: 1 });
    expect((await patch({ content: goodContent, baseVersion: 2 })).status).toBe(200);
    expect(fake.raw(docId)?.version).toBe(3);
  });
});

describe("content validation", () => {
  beforeEach(() => as(alice));
  it("rejects unsupported nodes, marks and levels with 400 and leaves the document untouched", async () => {
    const bad = [
      { type: "doc", content: [{ type: "codeBlock", content: [{ type: "text", text: "x" }] }] },
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link" }] }] }] },
      { type: "doc", content: [{ type: "heading", attrs: { level: 9 }, content: [{ type: "text", text: "x" }] }] },
      { type: "doc", content: [{ type: "script" }] },
      "just a string",
    ];
    for (const content of bad) {
      expect((await patch({ content, baseVersion: 1 })).status).toBe(400);
    }
    expect(fake.raw(docId)?.version).toBe(1);
  });
  it("requires baseVersion for content saves (400)", async () => {
    expect((await patch({ content: goodContent })).status).toBe(400);
  });
  it("rejects title and content in one request (400)", async () => {
    expect((await patch({ title: "x", content: goodContent, baseVersion: 1 })).status).toBe(400);
  });
  it("rejects malformed JSON (400) and oversized bodies (413)", async () => {
    expect((await PATCH(req("PATCH", "{oops"), ctx(docId))).status).toBe(400);
    const huge = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(1_300_000) }] }] };
    expect((await patch({ content: huge, baseVersion: 1 })).status).toBe(413);
  });
  it("answers 404 for malformed ids", async () => {
    expect((await get("not-a-uuid")).status).toBe(404);
    expect((await patch({ title: "x" }, "not-a-uuid")).status).toBe(404);
  });
});

describe("create", () => {
  it("defaults the title and validates a supplied one", async () => {
    as(alice);
    const ok = await CREATE(req("POST", {}));
    expect(ok.status).toBe(201);
    expect((await ok.json()).document.title).toBe("Untitled document");
    expect((await CREATE(req("POST", { title: "" }))).status).toBe(400);
  });
});
