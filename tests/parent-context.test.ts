import { describe, expect, it } from "vitest";
import { childContext, type ParentSession } from "@/server/parent-context";

const session = { ctx: { tenantId: "t1", guardianId: "g1", institutionType: "high_school", childIds: ["chisomo", "natasha"] } } as Pick<ParentSession, "ctx">;

describe("childContext", () => {
  it("opens a linked child's records in the guardian's school", () => {
    expect(childContext(session, "natasha")).toEqual({ tenantId: "t1", studentId: "natasha", institutionType: "high_school" });
  });

  it("refuses a child who is not linked to this guardian", () => {
    expect(childContext(session, "someone-else")).toBeUndefined();
    expect(childContext(session, "")).toBeUndefined();
  });
});
