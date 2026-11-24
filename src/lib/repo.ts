import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

// All SQL lives here so API tests can swap in an in-memory fake.
export type User = { id: string; email: string; name: string };

export type Repo = {
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  createSession(userId: string, ttlHours: number): Promise<{ token: string; expiresAt: Date }>;
  getUserBySession(token: string): Promise<User | null>;
  deleteSession(token: string): Promise<void>;
};

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
};

let current: Repo = sqlRepo;
export const repo = (): Repo => current;
/** Test hook: replace the data layer. */
export function setRepoForTests(r: Repo | null) {
  current = r ?? sqlRepo;
}
