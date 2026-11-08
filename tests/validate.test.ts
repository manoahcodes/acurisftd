import { describe, expect, it } from "vitest";
import { formatDate, parseMoney, readFormData, validateForm } from "@/lib/forms/validate";
import type { FormSpec } from "@/types/forms";

const spec: FormSpec = {
  id: "t", title: "t", submitLabel: "Save", target: "row", tableId: "t", keyColumns: ["Name"],
  fields: [
    { name: "name", label: "Name", type: "text", column: "Name", required: true, maxLength: 10, lockedOnEdit: true },
    { name: "email", label: "Email", type: "email", column: "Email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "amount", label: "Amount", type: "money", column: "Amount", required: true, min: 1 },
    { name: "count", label: "Count", type: "number", max: 10 },
    { name: "when", label: "Date", type: "date" },
    { name: "kind", label: "Kind", type: "select", options: ["A", "B"], required: true },
    { name: "tags", label: "Tags", type: "multiselect", options: ["x", "y"], required: true },
  ],
};
const good = { name: "Alice", email: "", phone: "", amount: "10.50", count: "", when: "", kind: "A", tags: ["x"] };

describe("validateForm", () => {
  it("accepts good input and leaves optional fields empty", () => {
    expect(validateForm(spec, good, "create").ok).toBe(true);
  });

  it("requires required fields", () => {
    const r = validateForm(spec, { ...good, name: "", kind: "", tags: [] }, "create");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["kind", "name", "tags"]);
  });

  it.each([
    ["email", "not-an-email"],
    ["phone", "abc"],
    ["when", "2026-02-30"],
    ["when", "10 Nov 2026"],
    ["amount", "1e3"],
    ["amount", "-5"],
    ["amount", "0x10"],
    ["amount", "1,500"],
    ["amount", "1.234"],
    ["amount", "0"],
    ["count", "1.5"],
    ["count", "11"],
    ["name", "this is far too long"],
    ["kind", "C"],
  ])("rejects %s = %s", (field, value) => {
    expect(validateForm(spec, { ...good, [field]: value }, "create").ok).toBe(false);
  });

  it("rejects a multiselect option that is not offered", () => {
    expect(validateForm(spec, { ...good, tags: ["z"] }, "create").ok).toBe(false);
  });

  it("ignores locked fields when editing", () => {
    const r = validateForm(spec, { ...good, name: "" }, "edit");
    expect(r.ok).toBe(true);
    if (r.ok) expect("name" in r.values).toBe(false);
  });

  it("requires a division choice only when the spec offers some", () => {
    const withDivs = { ...spec, divisionChoices: [{ id: "a", name: "A" }] };
    expect(validateForm(withDivs, good, "create").ok).toBe(false);
    expect(validateForm(withDivs, good, "create", { divisionId: "zzz" }).ok).toBe(false);
    expect(validateForm(withDivs, good, "create", { divisionId: "a" }).ok).toBe(true);
  });
});

describe("readFormData", () => {
  it("reads only the spec's fields, trimmed, with multiselect as a list", () => {
    const fd = new FormData();
    fd.set("name", "  Alice   Bee ");
    fd.append("tags", "x");
    fd.append("tags", "y");
    fd.set("evil", "ignored");
    const v = readFormData(spec, fd);
    expect(v.name).toBe("Alice Bee");
    expect(v.tags).toEqual(["x", "y"]);
    expect("evil" in v).toBe(false);
  });
});

describe("formatting", () => {
  it("formats dates and money", () => {
    expect(formatDate("2026-11-05")).toBe("05 Nov 2026");
    expect(parseMoney("1500.5")).toBe(1500.5);
  });
});
