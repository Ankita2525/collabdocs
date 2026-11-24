import { describe, it, expect } from "vitest";
import { can, getAccess } from "@/lib/access";

const OWNER = "owner-id";
const OTHER = "other-id";

describe("getAccess", () => {
  it("owner always has owner access, even if a share row exists", () => {
    expect(getAccess(OWNER, OWNER)).toBe("owner");
    expect(getAccess(OWNER, OWNER, "viewer")).toBe("owner");
  });
  it("returns the share role for other users", () => {
    expect(getAccess(OWNER, OTHER, "viewer")).toBe("viewer");
    expect(getAccess(OWNER, OTHER, "editor")).toBe("editor");
  });
  it("returns null for strangers and unknown roles", () => {
    expect(getAccess(OWNER, OTHER)).toBeNull();
    expect(getAccess(OWNER, OTHER, null)).toBeNull();
    // @ts-expect-error invalid role must never grant access
    expect(getAccess(OWNER, OTHER, "admin")).toBeNull();
  });
});

describe("can", () => {
  it("owner can do everything", () => {
    for (const a of ["read", "editContent", "rename", "delete", "share"] as const) {
      expect(can("owner", a)).toBe(true);
    }
  });
  it("editor can read and edit content only", () => {
    expect(can("editor", "read")).toBe(true);
    expect(can("editor", "editContent")).toBe(true);
    expect(can("editor", "rename")).toBe(false);
    expect(can("editor", "delete")).toBe(false);
    expect(can("editor", "share")).toBe(false);
  });
  it("viewer can only read", () => {
    expect(can("viewer", "read")).toBe(true);
    expect(can("viewer", "editContent")).toBe(false);
    expect(can("viewer", "rename")).toBe(false);
  });
  it("no access can do nothing", () => {
    expect(can(null, "read")).toBe(false);
  });
});
