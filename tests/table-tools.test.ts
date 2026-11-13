import { describe, expect, it } from "vitest";
import { applyFilters, csvFilename, filterableColumns, tableToCsv } from "@/lib/table-tools";

const columns = ["Report", "Period", "Status", "Notes"];
const rows = [
  ["Fees", "Term 1", "Ready", "a"],
  ["Arrears", "Term 2", "Pending", "b"],
  ["Fees", "Term 1", "Pending", "c"],
];

describe("table tools", () => {
  it("offers filters only for columns with a real choice", () => {
    const f = filterableColumns(columns, rows, "Status");
    expect(f.map((x) => x.column)).toEqual(["Period", "Status"]);
    expect(f[0].choices).toEqual(["Term 1", "Term 2"]);
    expect(filterableColumns(columns, [rows[0]], "Status")).toEqual([]);
  });
  it("combines drop-down filters and the text search", () => {
    expect(applyFilters(rows, { 1: "Term 1" })).toHaveLength(2);
    expect(applyFilters(rows, { 1: "Term 1", 2: "Pending" })).toEqual([rows[2]]);
    expect(applyFilters(rows, { 2: "" }, "arrears")).toEqual([rows[1]]);
    expect(applyFilters(rows, {})).toHaveLength(3);
  });
  it("exports what is shown, and defuses formulas", () => {
    expect(tableToCsv(["A", "B"], [["x", "=1+1"]])).toBe("A,B\r\nx,'=1+1\r\n");
    expect(csvFilename("Finance reports", "2026-11-12")).toBe("finance-reports-2026-11-12.csv");
  });
});
