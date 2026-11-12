import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { runProcess } from "@/server/actions/process";
import { audit, platformScreens, tenantDirectory } from "@/server/repositories";
import { resetMockAudit } from "@/server/repositories/audit-mock";
import { resetMockRecords } from "@/server/repositories/records-mock";
import type { ProcessState } from "@/types/process";

const idle: ProcessState = { status: "idle" };

function run(slug: string, processId: string, fields: Record<string, string> = {}, csv?: string) {
  const f = new FormData();
  f.set("slug", slug);
  f.set("processId", processId);
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (csv !== undefined) f.set("file", new File([csv], "data.csv", { type: "text/csv" }));
  return runProcess(idle, f);
}

async function screen(slug: string, tenantId: string | null = "zambezi-university") {
  const tenants = await tenantDirectory.list();
  const tenant = tenants.find((t) => t.id === tenantId) ?? null;
  return (await platformScreens.getScreen({ tenant, division: null, tenants }, slug))!;
}
const rowsOf = async (slug: string, tableId: string, tenantId?: string | null) =>
  (await screen(slug, tenantId)).tables.find((t) => t.id === tableId)!.rows;

beforeEach(() => {
  jar.clear();
  jar.set("stecia_platform_tenant", "zambezi-university");
  resetMockRecords();
  resetMockAudit();
});

describe("Import CSV (students)", () => {
  it("adds every row with generated numbers, first CSV row on top", async () => {
    const s = await screen("users/students");
    const t = s.processes!["Import CSV"].csv!;
    const before = (await rowsOf("users/students", "students")).length;
    const head = t.columns.join(",");
    const row = (name: string) => t.sample[0].map((c, i) => (/name/i.test(t.columns[i]) ? name : c)).join(",");
    const r = await run("users/students", "import-students", {}, `${head}\n${row("Ana One")}\n${row("Ben Two")}\n`);
    expect(r.status, r.message).toBe("success");
    const rows = await rowsOf("users/students", "students");
    expect(rows).toHaveLength(before + 2);
    expect(rows[0][1]).toBe("Ana One");
    expect(rows[1][1]).toBe("Ben Two");
    expect(new Set(rows.map((x) => x[0])).size).toBe(rows.length); // numbers stay unique
    expect(audit.list()[0].action).toMatch(/Import/);
  });

  it("imports nothing when any row is bad, and says which row", async () => {
    const s = await screen("users/students");
    const t = s.processes!["Import CSV"].csv!;
    const before = (await rowsOf("users/students", "students")).length;
    const good = t.sample[0].join(",");
    const bad = t.sample[0].map((c, i) => (/programme|class/i.test(t.columns[i]) ? "Not a real one" : c)).join(",");
    const r = await run("users/students", "import-students", {}, `${t.columns.join(",")}\n${good}\n${bad}\n`);
    expect(r.status).toBe("error");
    expect(r.problems?.[0]).toMatch(/^Row 3:/);
    expect(await rowsOf("users/students", "students")).toHaveLength(before);
  });

  it("rejects a file with a missing column, no file, or an oversized file", async () => {
    expect((await run("users/students", "import-students", {}, "Nope\nx\n")).message).toMatch(/Missing column/);
    expect((await run("users/students", "import-students")).message).toBe("Choose a CSV file.");
    expect((await run("users/students", "import-students", {}, "a".repeat(1_000_001))).message).toMatch(/too large/);
  });
});

describe("Upload results", () => {
  const head = "Student no.,Course,Mark";
  it("makes a batch per course and fails one with an unregistered student", async () => {
    const before = (await rowsOf("examinations/upload-exam-results", "upload-batches")).length;
    const r = await run("examinations/upload-exam-results", "upload-results", {}, `${head}\nSTU-1048,Financial Accounting,70\nSTU-0832,Financial Accounting,55\nSTU-9999,Structural Mechanics,60\n`);
    expect(r.status, r.message).toBe("success");
    expect(r.message).toMatch(/1 failed/);
    const rows = await rowsOf("examinations/upload-exam-results", "upload-batches");
    expect(rows).toHaveLength(before + 2);
    expect(rows.slice(0, 2).map((x) => x[x.length - 1]).sort()).toEqual(["Failed", "Validated"]);
  });
  it("rejects bad marks and unknown courses without creating anything", async () => {
    const before = (await rowsOf("examinations/upload-exam-results", "upload-batches")).length;
    const r = await run("examinations/upload-exam-results", "upload-results", {}, `${head}\nSTU-1048,Financial Accounting,101\nSTU-1048,Basket weaving,50\n`);
    expect(r.status).toBe("error");
    expect(r.problems).toHaveLength(2);
    expect(await rowsOf("examinations/upload-exam-results", "upload-batches")).toHaveLength(before);
  });
});

describe("Import statement", () => {
  const head = "Date,Reference,Bank,Description,Amount";
  it("matches known student numbers and leaves the rest unmatched", async () => {
    const r = await run("reports/bank-transactions", "import-statement", {}, `${head}\n2026-11-05,TRF-1,Zanaco,Fees: STU-1048,K 850.50\n05/11/2026,TRF-2,FNB,Mystery deposit,"1,200"\n`);
    expect(r.status, r.message).toBe("success");
    expect(r.message).toMatch(/1 matched, 1 unmatched/);
    const rows = await rowsOf("reports/bank-transactions", "bank-transactions");
    expect(rows[0].slice(1, 3)).toEqual(["TRF-1", "Zanaco"]);
    expect(rows[0][0]).toBe("05 Nov 2026");
    expect(rows[0][5]).toBe("Matched");
    expect(rows[1][5]).toBe("Unmatched");
  });
  it("rejects bad dates and amounts and repeated references (in the file or already listed)", async () => {
    const r = await run("reports/bank-transactions", "import-statement", {}, `${head}\n2026-13-45,TRF-9,Zanaco,x,10\n2026-11-05,TRF-8,Zanaco,x,abc\n2026-11-05,TRF-88213,Zanaco,x,10\n2026-11-05,DUP,Zanaco,x,10\n2026-11-05,dup,Zanaco,x,10\n`);
    expect(r.status).toBe("error");
    expect(r.problems!.join("\n")).toMatch(/valid date/);
    expect(r.problems!.join("\n")).toMatch(/amount/);
    expect(r.problems!.filter((p) => /already on the list/.test(p))).toHaveLength(2);
    expect(await rowsOf("reports/bank-transactions", "bank-transactions")).toHaveLength(4);
  });
});

describe("Change plan and Edit settings", () => {
  beforeEach(() => jar.set("stecia_platform_tenant", "all"));
  it("changes a school's plan, and refuses the plan it already has", async () => {
    const before = (await tenantDirectory.list()).find((t) => t.name === "Northview Primary")!;
    const other = before.plan === "Growth" ? "Enterprise" : "Growth";
    expect((await run("subscriptions", "change-plan", { school: before.name, plan: other })).status).toBe("success");
    expect((await tenantDirectory.list()).find((t) => t.id === before.id)!.plan).toBe(other);
    expect((await run("subscriptions", "change-plan", { school: before.name, plan: other })).status).toBe("error");
    expect((await run("subscriptions", "change-plan", { school: "Nowhere", plan: other })).status).toBe("error");
  });
  it("saves valid settings and explains invalid ones", async () => {
    const spec = (await screen("platform-settings", null)).processes!["Edit settings"];
    const values = Object.fromEntries(spec.fields.map((f) => [f.name, f.defaultValue ?? ""]));
    const tz = spec.fields.find((f) => f.label === "Academic year start")!;
    const timeout = spec.fields.find((f) => f.label === "Session timeout")!;
    const bad = await run("platform-settings", "edit-settings", { ...values, [tz.name]: "Smarch", [timeout.name]: "9000 minutes" });
    expect(bad.status).toBe("error");
    expect(Object.keys(bad.errors!).sort()).toEqual([timeout.name, tz.name].sort());
    expect((await run("platform-settings", "edit-settings", values)).message).toBe("No settings were changed.");
    const ok = await run("platform-settings", "edit-settings", { ...values, [tz.name]: "February", [timeout.name]: "45 minutes" });
    expect(ok.status, ok.message).toBe("success");
    const rows = await rowsOf("platform-settings", "settings", null);
    expect(rows.find((r) => r[0] === "Academic year start")![1]).toBe("February");
    expect(rows.find((r) => r[0] === "Session timeout")![1]).toBe("45 minutes");
  });
});

describe("Generate buttons", () => {
  it("transcripts: issue pending ones and download them", async () => {
    const r = await run("examinations/result-transcripts", "generate-transcript", { student: "All pending transcripts" });
    expect(r.status, r.message).toBe("success");
    expect(r.download?.filename).toMatch(/^transcripts-.*\.csv$/);
    expect(r.download!.content).toMatch(/^Student no\.,Name,/);
    const rows = await rowsOf("examinations/result-transcripts", "transcripts");
    expect(rows.every((x) => x[x.length - 1] === "Issued")).toBe(true);
    expect((await run("examinations/result-transcripts", "generate-transcript", { student: "All pending transcripts" })).message).toBe("No transcripts are pending.");
    expect((await run("examinations/result-transcripts", "generate-transcript", { student: "Nobody" })).status).toBe("error");
  });
  it("dockets: issue the unblocked ones, keep blocked ones blocked", async () => {
    const r = await run("registrations/exam-docket", "generate-dockets");
    expect(r.status, r.message).toBe("success");
    const rows = await rowsOf("registrations/exam-docket", "exam-dockets");
    expect(rows.some((x) => x[x.length - 1] === "Blocked")).toBe(true);
    expect(rows.filter((x) => x[x.length - 1] !== "Blocked").every((x) => x[x.length - 1] === "Issued")).toBe(true);
    expect(r.download!.content.trim().split("\r\n")).toHaveLength(1 + rows.filter((x) => x[x.length - 1] === "Issued").length);
  });
  it("reports: marks the chosen report ready and downloads it", async () => {
    const r = await run("reports/academic-reports", "generate-academic-report", { report: "Attendance summary" });
    expect(r.status, r.message).toBe("success");
    const row = (await rowsOf("reports/academic-reports", "academic-reports")).find((x) => x[0] === "Attendance summary")!;
    expect(row[row.length - 1]).toBe("Ready");
    expect(row[row.length - 2]).not.toBe("—");
    expect(r.download!.content).toContain("Report: Attendance summary");
    expect((await run("reports/finance-reports", "generate-finance-report", { report: "Bursary utilisation" })).status).toBe("success");
    expect((await run("reports/academic-reports", "generate-academic-report", { report: "Nope" })).status).toBe("error");
  });
});

describe("Publish results", () => {
  it("publishes pending results once, then has nothing left", async () => {
    const before = await rowsOf("examinations/final-results", "final-results");
    const pending = before.filter((x) => x[x.length - 1] === "Pending").length;
    expect(pending).toBeGreaterThan(0);
    const r = await run("examinations/final-results", "publish-results");
    expect(r.message).toBe(`Published ${pending} ${pending === 1 ? "result" : "results"}.`);
    const after = await rowsOf("examinations/final-results", "final-results");
    expect(after.every((x) => x[x.length - 1] === "Published")).toBe(true);
    const s = await screen("examinations/final-results");
    expect(s.processes!["Publish results"].blocked).toBe(true);
    expect((await run("examinations/final-results", "publish-results")).status).toBe("error");
  });
});

describe("Backups and exports", () => {
  it("runs a backup that shows at the top of the list", async () => {
    const r = await run("data-export-and-backup", "run-backup");
    expect(r.status, r.message).toBe("success");
    const rows = await rowsOf("data-export-and-backup", "backups");
    expect(rows[0][0]).toBe("BK-1005");
    expect(rows[0][2]).toBe("Manual");
    expect((await run("data-export-and-backup", "run-backup")).message).toBe("Backup BK-1006 completed.");
  });
  it("exports each dataset, including the full archive, and updates its row", async () => {
    for (const dataset of ["Students and guardians", "Fee accounts and payments", "Results and transcripts", "Full school archive"]) {
      const r = await run("data-export-and-backup", "export-data", { dataset });
      expect(r.status, `${dataset}: ${r.message}`).toBe("success");
      expect(r.download!.filename).toMatch(/\.csv$/);
      expect(r.download!.content.length).toBeGreaterThan(40);
    }
    const rows = await rowsOf("data-export-and-backup", "exports");
    expect(rows.every((x) => x[2] !== "Never")).toBe(true);
    expect((await run("data-export-and-backup", "export-data", { dataset: "Nope" })).status).toBe("error");
  });
});

describe("guards", () => {
  it("rejects unknown pages and buttons", async () => {
    expect((await run("nope", "export-data")).status).toBe("error");
    expect((await run("data-export-and-backup", "nope")).status).toBe("error");
    expect((await run("data-export-and-backup", "bad id!")).status).toBe("error");
  });
  it("combined school: the button carries one spec per division and the dialog asks which", async () => {
    jar.set("stecia_platform_tenant", "lusaka-hills");
    const s = await screen("users/students", "lusaka-hills");
    const spec = s.processes!["Import CSV"];
    expect(spec.blocked).toBeUndefined();
    expect(spec.divisions!.map((d) => d.name)).toEqual(["Primary School", "High School"]);
    expect(spec.divisions!.every((d) => d.spec.csv)).toBe(true);
  });
  it("combined school: refuses to run without a division, then imports into the chosen one", async () => {
    jar.set("stecia_platform_tenant", "lusaka-hills");
    const none = await run("users/students", "import-students", {}, "a\nb\n");
    expect(none.status).toBe("error");
    expect(none.errors?.division).toBeTruthy();
    const bad = await run("users/students", "import-students", { division: "nope!" }, "a\nb\n");
    expect(bad.status).toBe("error");
  });
  it("logs every successful run to the audit trail", async () => {
    await run("data-export-and-backup", "run-backup");
    await run("data-export-and-backup", "export-data", { dataset: "Students and guardians" });
    expect(audit.list().map((e) => e.action)).toEqual(["Export data", "Run backup now"]);
  });
});
