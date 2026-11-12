import { describe, expect, it } from "vitest";
import { parseCsv, readCsvTable, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, commas and newlines inside cells, CRLF and a BOM", () => {
    const rows = parseCsv('﻿Name,Note\r\n"Banda, Chisomo","said ""hi""\nthen left"\r\n\r\nZulu,ok\n');
    expect(rows).toEqual([["Name", "Note"], ["Banda, Chisomo", 'said "hi"\nthen left'], ["Zulu", "ok"]]);
  });
  it("skips blank lines and trims cells", () => {
    expect(parseCsv(" a , b \n\n , \nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("toCsv", () => {
  it("round-trips awkward cells", () => {
    const rows = [["a,b", 'q"q', "line\nbreak", "plain"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("defuses spreadsheet formulas but leaves numbers alone", () => {
    const out = toCsv([["=SUM(A1)", "+1", "-5", "-2.5", "@x"]]);
    expect(out.trim()).toBe("'=SUM(A1),'+1,-5,-2.5,'@x");
  });
});

describe("readCsvTable", () => {
  it("matches headers ignoring case and spacing, in any order", () => {
    const r = readCsvTable("MARK, student  no.\n70,STU-1", ["Student no.", "Mark"]);
    expect(r.ok && r.table.rows).toEqual([{ "Student no.": "STU-1", Mark: "70" }]);
  });
  it("names missing columns, and rejects empty or header-only files", () => {
    expect(readCsvTable("a,b\n1,2", ["a", "c", "d"])).toEqual({ ok: false, message: "Missing columns: c, d." });
    expect(readCsvTable("", ["a"])).toMatchObject({ ok: false });
    expect(readCsvTable("a", ["a"])).toMatchObject({ ok: false, message: "The file has a header but no rows." });
  });
  it("allows optional columns to be absent", () => {
    const r = readCsvTable("a\n1", ["a", "b"], ["a"]);
    expect(r.ok && r.table.rows[0]).toEqual({ a: "1", b: "" });
  });
});
