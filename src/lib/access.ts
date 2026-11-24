export type ShareRole = "viewer" | "editor";
export type Access = "owner" | ShareRole;
export type Action = "read" | "editContent" | "rename" | "delete" | "share";

/** The single place document permissions are decided. null = no access (callers answer 404). */
export function getAccess(ownerId: string, userId: string, shareRole?: ShareRole | null): Access | null {
  if (ownerId === userId) return "owner";
  if (shareRole === "editor" || shareRole === "viewer") return shareRole;
  return null;
}

const ALLOWED: Record<Access, readonly Action[]> = {
  owner: ["read", "editContent", "rename", "delete", "share"],
  editor: ["read", "editContent"],
  viewer: ["read"],
};

export function can(access: Access | null, action: Action): boolean {
  return access !== null && ALLOWED[access].includes(action);
}
