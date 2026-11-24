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

import { GET as GET_DOC, PATCH as PATCH_DOC } from "@/app/api/documents/[id]/route";
import { GET as LIST, POST as CREATE } from "@/app/api/documents/route";
import { GET as GET_SHARES, POST as POST_SHARE } from "@/app/api/documents/[id]/shares/route";
import { DELETE as DELETE_SHARE } from "@/app/api/documents/[id]/shares/[userId]/route";

const mk = (n: number, name: string): User => ({
  id: `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`,
  email: `${name.toLowerCase()}@x`,
  name,
});
const alice = mk(1, "Alice");
const bob = mk(2, "Bob");
const carol = mk(3, "Carol");
const dan = mk(4, "Dan"); // never shared with

const content = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

let fake: ReturnType<typeof createFakeRepo>;
let docId: string;

const req = (method: string, body?: unknown) =>
  new Request("http://test/api", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const as = (u: User | null) => {
  currentUser = u;
};
const share = (userId: string, role: unknown, id = docId) => POST_SHARE(req("POST", { userId, role }), ctx(id));
const listShares = (id = docId) => GET_SHARES(req("GET"), ctx(id));
const revoke = (userId: string, id = docId) =>
  DELETE_SHARE(req("DELETE"), { params: Promise.resolve({ id, userId }) });
const getDoc = () => GET_DOC(req("GET"), ctx(docId));
const save = (v: number, text = "x") => PATCH_DOC(req("PATCH", { content: content(text), baseVersion: v }), ctx(docId));

beforeEach(async () => {
  fake = createFakeRepo([alice, bob, carol, dan]);
  setRepoForTests(fake.repo);
  as(alice);
  docId = (await (await CREATE(req("POST", { title: "Shared plan" }))).json()).document.id;
});

describe("authentication", () => {
  it("all sharing endpoints require a session (401)", async () => {
    as(null);
    expect((await listShares()).status).toBe(401);
    expect((await share(bob.id, "viewer")).status).toBe(401);
    expect((await revoke(bob.id)).status).toBe(401);
  });
});

describe("owner-only sharing management", () => {
  beforeEach(async () => {
    await share(bob.id, "viewer");
    await share(carol.id, "editor");
  });

  it("viewer and editor get 403 on list, share and revoke; nothing changes", async () => {
    for (const u of [bob, carol]) {
      as(u);
      expect((await listShares()).status).toBe(403);
      expect((await share(dan.id, "editor")).status).toBe(403);
      expect((await share(u.id, "editor")).status).toBe(403); // cannot escalate themselves
      expect((await revoke(bob.id)).status).toBe(403);
      expect((await revoke(carol.id)).status).toBe(403);
    }
    as(alice);
    const { shares } = await (await listShares()).json();
    expect(shares.map((s: { userId: string; role: string }) => [s.userId, s.role])).toEqual([
      [bob.id, "viewer"],
      [carol.id, "editor"],
    ]);
  });

  it("a user with no access gets 404 (existence not leaked)", async () => {
    as(dan);
    expect((await listShares()).status).toBe(404);
    expect((await share(dan.id, "editor")).status).toBe(404);
    expect((await revoke(bob.id)).status).toBe(404);
  });

  it("owner can list shares with names, emails and roles", async () => {
    const res = await listShares();
    expect(res.status).toBe(200);
    expect((await res.json()).shares).toEqual([
      { userId: bob.id, name: "Bob", email: "bob@x", role: "viewer" },
      { userId: carol.id, name: "Carol", email: "carol@x", role: "editor" },
    ]);
  });
});

describe("share validation", () => {
  it("rejects invalid role, bad userId and sharing with yourself (400)", async () => {
    expect((await share(bob.id, "admin")).status).toBe(400);
    expect((await share(bob.id, undefined)).status).toBe(400);
    expect((await share("not-a-uuid", "viewer")).status).toBe(400);
    const self = await share(alice.id, "editor");
    expect(self.status).toBe(400);
    expect((await self.json()).error.message).toMatch(/already own/i);
    expect((await (await listShares()).json()).shares).toEqual([]);
  });
  it("answers 404 for a user that does not exist", async () => {
    expect((await share("99999999-9999-4999-8999-999999999999", "viewer")).status).toBe(404);
  });
  it("answers 400 for a malformed JSON body", async () => {
    const res = await POST_SHARE(new Request("http://t", { method: "POST", body: "{nope" }), ctx(docId));
    expect(res.status).toBe(400);
  });
  it("revoking someone who has no access is 404; a malformed user id is 400", async () => {
    expect((await revoke(bob.id)).status).toBe(404);
    expect((await revoke("nope")).status).toBe(400);
  });
});

describe("viewer permissions after sharing", () => {
  beforeEach(async () => {
    expect((await share(bob.id, "viewer")).status).toBe(200);
  });
  it("viewer can read (role viewer) but not save, rename or delete", async () => {
    as(bob);
    const res = await getDoc();
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("viewer");
    expect((await save(1)).status).toBe(403);
    expect((await PATCH_DOC(req("PATCH", { title: "x" }), ctx(docId))).status).toBe(403);
  });
  it("document appears in the viewer's shared list with owner and role; owner sees shareCount", async () => {
    as(bob);
    const list = await (await LIST()).json();
    expect(list.owned).toEqual([]);
    expect(list.shared[0]).toMatchObject({ id: docId, role: "viewer", ownerName: "Alice" });
    as(alice);
    expect((await (await LIST()).json()).owned[0]).toMatchObject({ id: docId, shareCount: 1 });
  });
});

describe("changing access", () => {
  it("viewer -> editor lets the user save", async () => {
    await share(bob.id, "viewer");
    as(bob);
    expect((await save(1)).status).toBe(403);
    as(alice);
    expect((await share(bob.id, "editor")).status).toBe(200);
    as(bob);
    expect((await save(1)).status).toBe(200);
    expect((await (await listShares_asOwner()).json()).shares).toHaveLength(1); // upsert, not duplicate
  });
  it("editor -> viewer revokes write access immediately (already-open editor gets 403 on next save)", async () => {
    await share(bob.id, "editor");
    as(bob);
    const opened = await (await getDoc()).json(); // bob has the editor open at this version
    expect((await save(opened.document.version, "first")).status).toBe(200);
    as(alice);
    await share(bob.id, "viewer");
    as(bob);
    const late = await save(opened.document.version + 1, "after downgrade");
    expect(late.status).toBe(403);
    expect(JSON.stringify(fake.raw(docId)?.content)).toContain("first");
    expect(JSON.stringify(fake.raw(docId)?.content)).not.toContain("after downgrade");
    expect((await getDoc()).status).toBe(200); // still can read
  });
});

describe("revoking access", () => {
  it("after revoke the user gets 404 for read and save, and the doc leaves their list", async () => {
    await share(bob.id, "editor");
    as(bob);
    const opened = await (await getDoc()).json();
    as(alice);
    expect((await revoke(bob.id)).status).toBe(200);
    as(bob);
    expect((await getDoc()).status).toBe(404);
    expect((await save(opened.document.version, "ghost")).status).toBe(404);
    expect((await PATCH_DOC(req("PATCH", { title: "x" }), ctx(docId))).status).toBe(404);
    expect((await (await LIST()).json()).shared).toEqual([]);
    expect(JSON.stringify(fake.raw(docId)?.content)).not.toContain("ghost");
  });
  it("revoking one user does not affect another", async () => {
    await share(bob.id, "viewer");
    await share(carol.id, "viewer");
    await revoke(bob.id);
    as(carol);
    expect((await getDoc()).status).toBe(200);
  });
  it("deleting a document removes its shares", async () => {
    await share(bob.id, "viewer");
    await fake.repo.deleteDocument(docId);
    as(bob);
    expect((await getDoc()).status).toBe(404);
    expect((await (await LIST()).json()).shared).toEqual([]);
  });
});

async function listShares_asOwner() {
  as(alice);
  return listShares();
}
