import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { getDb } from "@/lib/db";
import type { ShareRole } from "@/lib/access";

// All SQL lives here so API tests can swap in an in-memory fake.
export type User = { id: string; email: string; name: string };

export type DocSummary = {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
  ownerId: string;
  ownerName: string;
};
export type DocumentRecord = DocSummary & {
  content: unknown;
  createdAt: string;
  /** The current user's share role, if they are not the owner. */
  shareRole: ShareRole | null;
};
export type DocumentList = {
  owned: DocSummary[];
  shared: (DocSummary & { role: ShareRole })[];
};

export type Repo = {
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  createSession(userId: string, ttlHours: number): Promise<{ token: string; expiresAt: Date }>;
  getUserBySession(token: string): Promise<User | null>;
  deleteSession(token: string): Promise<void>;
  listDocuments(userId: string): Promise<DocumentList>;
  createDocument(ownerId: string, title: string): Promise<DocSummary>;
  /** Loads a document plus the given user's share role in one query. No permission check here. */
  getDocument(id: string, userId: string): Promise<DocumentRecord | null>;
  renameDocument(id: string, title: string): Promise<DocSummary | null>;
  deleteDocument(id: string): Promise<boolean>;
  /**
   * Atomic compare-and-set on `version`: one UPDATE ... WHERE id AND version = baseVersion.
   * Returns null when no row matched (document gone OR version is stale; caller tells them apart).
   */
  updateContent(id: string, content: unknown, baseVersion: number): Promise<{ version: number; updatedAt: string } | null>;
};

type SummaryRow = {
  id: string;
  title: string;
  version: number;
  updated_at: Date;
  owner_id: string;
  owner_name: string;
};
const toSummary = (r: SummaryRow): DocSummary => ({
  id: r.id,
  title: r.title,
  version: r.version,
  updatedAt: r.updated_at.toISOString(),
  ownerId: r.owner_id,
  ownerName: r.owner_name,
});

export const sqlRepo: Repo = {
  async listUsers() {
    return getDb()<User[]>`select id, email, name from users order by name`;
  },
  async getUser(id) {
    const rows = await getDb()<User[]>`select id, email, name from users where id = ${id}`;
    return rows[0] ?? null;
  },
  async createSession(userId, ttlHours) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
    await getDb()`insert into sessions (token, user_id, expires_at) values (${token}, ${userId}, ${expiresAt})`;
    return { token, expiresAt };
  },
  async getUserBySession(token) {
    const rows = await getDb()<User[]>`
      select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id
      where s.token = ${token} and s.expires_at > now()`;
    return rows[0] ?? null;
  },
  async deleteSession(token) {
    await getDb()`delete from sessions where token = ${token}`;
  },
  async listDocuments(userId) {
    const sql = getDb();
    const owned = await sql<SummaryRow[]>`
      select d.id, d.title, d.version, d.updated_at, d.owner_id, u.name as owner_name
      from documents d join users u on u.id = d.owner_id
      where d.owner_id = ${userId} order by d.updated_at desc`;
    const shared = await sql<(SummaryRow & { role: ShareRole })[]>`
      select d.id, d.title, d.version, d.updated_at, d.owner_id, u.name as owner_name, s.role
      from document_shares s
      join documents d on d.id = s.document_id
      join users u on u.id = d.owner_id
      where s.user_id = ${userId} order by d.updated_at desc`;
    return { owned: owned.map(toSummary), shared: shared.map((r) => ({ ...toSummary(r), role: r.role })) };
  },
  async createDocument(ownerId, title) {
    const rows = await getDb()<SummaryRow[]>`
      with d as (insert into documents (owner_id, title) values (${ownerId}, ${title}) returning *)
      select d.id, d.title, d.version, d.updated_at, d.owner_id, u.name as owner_name
      from d join users u on u.id = d.owner_id`;
    return toSummary(rows[0]);
  },
  async getDocument(id, userId) {
    const rows = await getDb()<(SummaryRow & { content: unknown; created_at: Date; share_role: ShareRole | null })[]>`
      select d.id, d.title, d.version, d.updated_at, d.created_at, d.content, d.owner_id,
             u.name as owner_name, s.role as share_role
      from documents d
      join users u on u.id = d.owner_id
      left join document_shares s on s.document_id = d.id and s.user_id = ${userId}
      where d.id = ${id}`;
    const r = rows[0];
    if (!r) return null;
    return {
      ...toSummary(r),
      content: r.content,
      createdAt: r.created_at.toISOString(),
      shareRole: r.share_role,
    };
  },
  async renameDocument(id, title) {
    const rows = await getDb()<SummaryRow[]>`
      with d as (update documents set title = ${title}, updated_at = now() where id = ${id} returning *)
      select d.id, d.title, d.version, d.updated_at, d.owner_id, u.name as owner_name
      from d join users u on u.id = d.owner_id`;
    return rows[0] ? toSummary(rows[0]) : null;
  },
  async updateContent(id, content, baseVersion) {
    const sql = getDb();
    const rows = await sql<{ version: number; updated_at: Date }[]>`
      update documents
      set content = ${sql.json(content as postgres.JSONValue)}, version = version + 1, updated_at = now()
      where id = ${id} and version = ${baseVersion}
      returning version, updated_at`;
    return rows[0] ? { version: rows[0].version, updatedAt: rows[0].updated_at.toISOString() } : null;
  },
  async deleteDocument(id) {
    const rows = await getDb()`delete from documents where id = ${id} returning id`;
    return rows.length > 0;
  },
};

let current: Repo = sqlRepo;
export const repo = (): Repo => current;
/** Test hook: replace the data layer. */
export function setRepoForTests(r: Repo | null) {
  current = r ?? sqlRepo;
}
