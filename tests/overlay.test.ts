import { beforeEach, describe, expect, it } from "vitest";
import { applyOverlay, emptyOverlay, nextKey, normaliseKey } from "@/lib/forms/overlay";
import { cellToValue, keyForRow, resolveSpec } from "@/lib/forms/spec";
import { mockRecordStore, resetMockRecords } from "@/server/repositories/records-mock";
import type { TableSection } from "@/types/platform";

const base: TableSection = {
  id: "t", title: "T", columns: ["Name", "City", "Status"],
  rows: [["A", "Lusaka", "Active"], ["B", "Kitwe", "Active"]],
};

describe("applyOverlay", () => {
  it("returns the table untouched without an overlay", () => {
    expect(applyOverlay(base, undefined)).toBe(base);
    expect(applyOverlay(base, emptyOverlay())).toBe(base);
  });
  it("puts new rows first and fills missing columns with a dash", () => {
    const t = applyOverlay(base, { added: [{ Name: "C", City: "Ndola" }], edits: {} });
    expect(t.rows[0]).toEqual(["C", "Ndola", "—"]);
    expect(t.rows).toHaveLength(3);
  });
  it("applies edits by key, to base and new rows, and ignores unknown columns", () => {
    const t = applyOverlay(base, {
      added: [{ Name: "C", City: "Ndola", Status: "Active" }],
      edits: { B: { City: "Chingola", Nope: "x" }, C: { Status: "Pending" } },
    });
    expect(t.rows.find((r) => r[0] === "B")).toEqual(["B", "Chingola", "Active"]);
    expect(t.rows.find((r) => r[0] === "C")![2]).toBe("Pending");
  });
  it("supports composite keys", () => {
    const t = applyOverlay(base, { added: [], edits: { "A | Lusaka": { Status: "Off" } } }, ["Name", "City"]);
    expect(t.rows[0][2]).toBe("Off");
    expect(t.rows[1][2]).toBe("Active");
  });
});

describe("keys", () => {
  it("numbers after the highest used", () => {
    expect(nextKey(["RC-00010", "RC-00002", "other"], "RC-", 5)).toBe("RC-00011");
    expect(nextKey([], "STF-", 4)).toBe("STF-0001");
    expect(nextKey(["#SUP-1048"], "#SUP-", 4)).toBe("#SUP-1049");
  });
  it("compares keys loosely", () => {
    expect(normaliseKey("  East   Campus ")).toBe(normaliseKey("east campus"));
  });
  it("builds a key from columns, or null if one is missing", () => {
    expect(keyForRow(["A", "B"], ["1", "2"], ["B", "A"])).toBe("2 | 1");
    expect(keyForRow(["A"], ["1"], ["Z"])).toBeNull();
  });
});

describe("cellToValue", () => {
  const f = (type: "money" | "number" | "date" | "text") => ({ name: "x", label: "x", type });
  it("reverses the table formatting", () => {
    expect(cellToValue(f("money"), "K 1,500.50")).toBe("1500.50");
    expect(cellToValue(f("number"), "30%")).toBe("30");
    expect(cellToValue(f("date"), "05 Nov 2026")).toBe("2026-11-05");
    expect(cellToValue(f("text"), "—")).toBe("");
  });
  it("gives empty rather than a wrong value", () => {
    expect(cellToValue(f("date"), "Jan 2026")).toBe("");
    expect(cellToValue(f("money"), "n/a")).toBe("");
  });
});

describe("resolveSpec", () => {
  it("swaps in a division's fields", () => {
    const spec = {
      id: "s", title: "s", submitLabel: "Save", target: "row" as const, tableId: "t", keyColumns: ["A"],
      fields: [{ name: "a", label: "A", type: "text" as const }],
      variants: { d1: { fields: [{ name: "b", label: "B", type: "text" as const }] } },
    };
    expect(resolveSpec(spec, "d1").fields[0].name).toBe("b");
    expect(resolveSpec(spec, "other")).toBe(spec);
  });
});

describe("mock record store", () => {
  beforeEach(resetMockRecords);
  it("keeps scopes apart and merges edits", () => {
    mockRecordStore.add("s1", "t", { Name: "X" });
    mockRecordStore.edit("s1", "t", "X", { City: "A" });
    mockRecordStore.edit("s1", "t", "X", { Status: "B" });
    expect(mockRecordStore.overlay("s1", "t")!.edits.X).toEqual({ City: "A", Status: "B" });
    expect(mockRecordStore.overlay("s2", "t")).toBeUndefined();
  });
});
