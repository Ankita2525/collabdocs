import type { ShareRole } from "@/lib/access";
import type { DocSummary, DocumentList, DocumentRecord, Repo, User } from "@/lib/repo";

type Doc = { id: string; ownerId: string; title: string; content: unknown; version: number; createdAt: Date; updatedAt: Date };

/** In-memory Repo for API-level tests. Mirrors the SQL semantics (esp. the version compare-and-set). */
export function createFakeRepo(users: User[]) {
  const docs = new Map<string, Doc>();
  const shares = new Map<string, ShareRole>(); // `${docId}:${userId}`
  let counter = 0;
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "?";
  const summary = (d: Doc): DocSummary => ({
    id: d.id,
    title: d.title,
    version: d.version,
    updatedAt: d.updatedAt.toISOString(),
    ownerId: d.ownerId,
    ownerName: nameOf(d.ownerId),
  });

  const repo: Repo = {
    async listUsers() {
      return users;
    },
    async getUser(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async createSession() {
      throw new Error("not used in these tests");
    },
    async getUserBySession() {
      return null;
    },
    async deleteSession() {},
    async listDocuments(userId): Promise<DocumentList> {
      const all = [...docs.values()];
      return {
        owned: all.filter((d) => d.ownerId === userId).map(summary),
        shared: all.flatMap((d) => {
          const role = shares.get(`${d.id}:${userId}`);
          return role ? [{ ...summary(d), role }] : [];
        }),
      };
    },
    async createDocument(ownerId, title) {
      const now = new Date();
      const d: Doc = {
        id: `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
        ownerId,
        title,
        content: { type: "doc", content: [{ type: "paragraph" }] },
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      docs.set(d.id, d);
      return summary(d);
    },
    async getDocument(id, userId): Promise<DocumentRecord | null> {
      const d = docs.get(id);
      if (!d) return null;
      return {
        ...summary(d),
        content: structuredClone(d.content),
        createdAt: d.createdAt.toISOString(),
        shareRole: shares.get(`${id}:${userId}`) ?? null,
      };
    },
    async renameDocument(id, title) {
      const d = docs.get(id);
      if (!d) return null;
      d.title = title;
      d.updatedAt = new Date();
      return summary(d);
    },
    async updateContent(id, content, baseVersion) {
      const d = docs.get(id);
      if (!d || d.version !== baseVersion) return null; // compare-and-set
      d.content = structuredClone(content);
      d.version += 1;
      d.updatedAt = new Date();
      return { version: d.version, updatedAt: d.updatedAt.toISOString() };
    },
    async deleteDocument(id) {
      for (const k of [...shares.keys()]) if (k.startsWith(`${id}:`)) shares.delete(k);
      return docs.delete(id);
    },
  };

  return {
    repo,
    /** Test helper: the sharing API does not exist yet, so seed share rows directly. */
    addShare(docId: string, userId: string, role: ShareRole) {
      shares.set(`${docId}:${userId}`, role);
    },
    raw: (id: string) => docs.get(id),
  };
}
