import { MONTH_NAMES } from "@/lib/format";
import { readCsvTable } from "@/lib/csv";
import { formatStamp, todayIn } from "@/lib/format";
import { nextKey, normaliseKey } from "@/lib/forms/overlay";
import { askedFields } from "@/lib/forms/spec";
import { formatDate, validateForm } from "@/lib/forms/validate";
import type { FieldDef, FormErrors, FormValues } from "@/types/forms";
import type { Download, ProcessSpec } from "@/types/process";
import type { PlatformScreen, TableSection } from "@/types/platform";
import { DEPLOYMENTS, DEPLOYMENT_MODE } from "@/config/deployment";
import { buildNewRow } from "../forms/create";
import { entryById } from "../forms/registry";
import { recordScope } from "../forms/scope";
import { isDivisionScoped } from "../repositories/platform-mock/divisions";
import type { Division } from "@/config/institution";
import type { PlatformContext } from "../repositories/platform-types";
import { COURSE_ROWS, K, LEARNERS, flavour, type Flavour } from "../repositories/platform-mock/shared";
import { records, tenantDirectory } from "../repositories";
import { docketsCsv, exportCsv, reportCsv, transcriptCsv } from "./content";

const MAX_IMPORT_ROWS = 500;
const SHOW_PROBLEMS = 8;

export type RunInput = {
  slug: string;
  ctx: PlatformContext;
  screen: PlatformScreen;
  f: Flavour;
  values: FormValues;
  csv?: string;
  user: string;
  /** The school's time zone (Branding), used for every date a process writes. */
  timeZone: string;
};

export type Outcome =
  | { ok: true; message: string; entity: string; download?: Download; problems?: string[] }
  | { ok: false; message: string; problems?: string[]; errors?: FormErrors };

export type ProcessEntry = {
  /** Button label, as the screen builder words it. */
  action: string;
  spec: ProcessSpec;
  run: (input: RunInput) => Promise<Outcome>;
};

type Maker = (ctx: PlatformContext, f: Flavour, screen: PlatformScreen) => ProcessEntry[];

// ---------- helpers ----------
const table = (screen: PlatformScreen, id: string): TableSection | undefined => screen.tables.find((t) => t.id === id);
const str = (v: FormValues, name: string) => (typeof v[name] === "string" ? (v[name] as string) : "");
const csvFile = (name: string, content: string): Download => ({ filename: name, mime: "text/csv;charset=utf-8", content });
const idx = (t: TableSection, column: string) => t.columns.indexOf(column);
const tidy = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
const fail = (message: string, extra: Partial<Extract<Outcome, { ok: false }>> = {}): Outcome => ({ ok: false, message, ...extra });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const digitsOf = (no: string) => /(\d+)$/.exec(no)?.[1] ?? "";
const KNOWN_DIGITS = new Set(LEARNERS.map((l) => digitsOf(l.no)));

/** A statement or results file's date: 2026-11-04, 04/11/2026 or 04 Nov 2026. */
function parseLooseDate(text: string): string | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  let hit = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  else if ((hit = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) [d, m, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  else if ((hit = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(t))) {
    m = MONTH_NAMES.findIndex((n) => n.toLowerCase() === hit![2].toLowerCase()) + 1;
    [d, y] = [Number(hit[1]), Number(hit[3])];
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (m < 1 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const sampleFor = (f: FieldDef): string => {
  if (f.options?.length) return f.options[0];
  if (f.defaultValue) return f.defaultValue;
  switch (f.type) {
    case "email": return "name@example.com";
    case "tel": return "0971234567";
    case "date": return "2026-01-15";
    case "number": case "money": return "1";
    default: return /name/i.test(f.label) ? "Mwila Banda" : "Example";
  }
};

function problemsOutcome(what: string, problems: string[]): Outcome {
  const shown = problems.slice(0, SHOW_PROBLEMS);
  if (problems.length > shown.length) shown.push(`...and ${problems.length - shown.length} more.`);
  return fail(`Nothing was imported: ${plural(problems.length, "problem")} found in ${what}. Fix the file and try again.`, { problems: shown });
}

const blocked = (action: string, id: string, title: string, intro: string): ProcessEntry => ({
  action,
  spec: { id, title, submitLabel: "Run", intro, fields: [], blocked: true },
  run: async () => fail(intro),
});

// ---------- makers by page slug ----------
const MAKERS: Record<string, Maker> = {
  // Import CSV: every row goes through the same checks as the Add student form.
  "users/students": (ctx, f, screen) => {
    const entry = entryById("users/students", "student", ctx);
    const t = entry && table(screen, entry.spec.tableId);
    if (!entry || !t) return [];
    const fields = askedFields(entry.spec, "create");
    const columns = fields.map((x) => x.label);
    return [
      {
        action: "Import CSV",
        spec: {
          id: "import-students",
          title: `Import ${f.tertiary ? "students" : "learners"} from CSV`,
          submitLabel: "Import",
          intro: `One row per ${f.tertiary ? "student" : "learner"}. Student numbers are generated. If any row has a problem, nothing is imported.`,
          fields: [],
          csv: { columns, sample: [fields.map(sampleFor)] },
        },
        async run({ csv, ctx: c, f: fl, screen: s }) {
          const e = entryById("users/students", "student", c);
          const tbl = e && table(s, e.spec.tableId);
          if (!e || !tbl || !csv) return fail("Choose a CSV file.");
          const read = readCsvTable(csv, columns, fields.filter((x) => x.required).map((x) => x.label));
          if (!read.ok) return fail(read.message);
          if (read.table.rows.length > MAX_IMPORT_ROWS) return fail(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
          const working = tbl.rows.map((r) => [...r]);
          const added: Record<string, string>[] = [];
          const problems: string[] = [];
          read.table.rows.forEach((raw, i) => {
            const values: FormValues = {};
            for (const x of fields) {
              let v = raw[x.label] ?? "";
              if (x.type === "select") v = x.options?.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v;
              if (x.type === "multiselect") { values[x.name] = v.split(";").map((p) => p.trim()).filter(Boolean); continue; }
              values[x.name] = v === "" && x.defaultValue ? x.defaultValue : v;
            }
            const checked = validateForm(e.spec, values, "create");
            if (!checked.ok) {
              for (const msg of Object.values(checked.errors)) problems.push(`Row ${i + 2}: ${msg}`);
              return;
            }
            const built = buildNewRow(e, checked.values, tbl.columns, working, fl);
            if (!built.ok) { problems.push(`Row ${i + 2}: ${built.message}`); return; }
            working.push(tbl.columns.map((col) => built.cells[col] ?? "—"));
            added.push(built.cells);
          });
          if (problems.length > 0) return problemsOutcome("the file", problems);
          const scope = recordScope("users/students", c);
          for (const cells of [...added].reverse()) records.add(scope, e.spec.tableId, cells);
          return { ok: true, message: `Imported ${plural(added.length, f.tertiary ? "student" : "learner")}.`, entity: `Students: ${added.length} imported from CSV` };
        },
      },
    ];
  },

  "examinations/upload-exam-results": (ctx, f, screen) => {
    const t = table(screen, "upload-batches");
    if (!t) return [];
    const courses = COURSE_ROWS(f.tertiary, f.primary);
    const columns = ["Student no.", "Course", "Mark"];
    return [
      {
        action: "Upload results",
        spec: {
          id: "upload-results",
          title: "Upload exam results",
          submitLabel: "Upload",
          intro: `One row per mark. The course is its code or name, and marks run from 0 to 100. A course whose file has a student who is not registered becomes a failed batch.`,
          fields: [],
          csv: { columns, sample: [[LEARNERS[0].no, courses[0][1], "72"]] },
        },
        async run({ csv, user, screen: s, ctx: c, slug, timeZone: zone }) {
          const tbl = table(s, "upload-batches");
          if (!tbl || !csv) return fail("Choose a CSV file.");
          const read = readCsvTable(csv, columns);
          if (!read.ok) return fail(read.message);
          if (read.table.rows.length > MAX_IMPORT_ROWS * 10) return fail("That file is too large.");
          const problems: string[] = [];
          const byCourse = new Map<string, { count: number; unknown: string[] }>();
          read.table.rows.forEach((r, i) => {
            const course = courses.find(([code, title]) => [code, title].some((x) => x.toLowerCase() === r["Course"].toLowerCase()));
            if (!course) { problems.push(`Row ${i + 2}: "${r["Course"]}" is not one of your ${f.terms.courses.toLowerCase()}.`); return; }
            if (!/^\d+(\.\d+)?$/.test(r["Mark"]) || Number(r["Mark"]) > 100) { problems.push(`Row ${i + 2}: mark must be a number from 0 to 100.`); return; }
            const group = byCourse.get(course[1]) ?? { count: 0, unknown: [] };
            group.count += 1;
            if (!KNOWN_DIGITS.has(digitsOf(r["Student no."]))) group.unknown.push(r["Student no."] || `(row ${i + 2})`);
            byCourse.set(course[1], group);
          });
          if (problems.length > 0) return problemsOutcome("the file", problems);
          const scope = recordScope(slug, c);
          const keys = tbl.rows.map((row) => row[0]);
          const today = todayIn(zone).display;
          let failed = 0;
          const notes: string[] = [];
          for (const [course, g] of byCourse) {
            const batch = nextKey(keys, "UP-", 4);
            keys.push(batch);
            const bad = g.unknown.length > 0;
            if (bad) { failed += 1; notes.push(`${course}: ${plural(g.unknown.length, "student")} not registered (${[...new Set(g.unknown)].slice(0, 3).join(", ")}).`); }
            records.add(scope, "upload-batches", {
              Batch: batch, [f.terms.course]: course, "Uploaded by": user, Records: String(g.count),
              "Uploaded on": today, Status: bad ? "Failed" : "Validated",
            });
          }
          const total = read.table.rows.length;
          return {
            ok: true, entity: `Upload exam results: ${plural(byCourse.size, "batch", "batches")}`, problems: notes,
            message: `Uploaded ${plural(total, "mark")} in ${plural(byCourse.size, "batch", "batches")}${failed ? `; ${failed} failed validation` : ""}.`,
          };
        },
      },
    ];
  },

  "examinations/result-transcripts": (ctx, f, screen) => {
    const t = table(screen, "transcripts");
    if (!t) return [];
    const students = t.rows.map((r) => r[0]);
    return [
      {
        action: "Generate transcript",
        spec: {
          id: "generate-transcript",
          title: "Generate transcript",
          submitLabel: "Generate and download",
          intro: "Marks the transcript as issued and downloads it as a CSV file.",
          fields: [{ name: "student", label: "Student", type: "select", required: true, options: ["All pending transcripts", ...students], defaultValue: "All pending transcripts" }],
        },
        async run({ values, screen: s, slug, ctx: c, f: fl }) {
          const tbl = table(s, "transcripts");
          if (!tbl) return fail("That table is not available.");
          const choice = str(values, "student");
          const si = idx(tbl, "Status");
          const period = fl.periodName(fl.tertiary ? 1 : 2);
          const targets = choice === "All pending transcripts" ? tbl.rows.filter((r) => r[si] === "Pending").map((r) => r[0]) : tbl.rows.filter((r) => r[0] === choice).map((r) => r[0]);
          if (targets.length === 0) return fail(choice === "All pending transcripts" ? "No transcripts are pending." : "That student is not in the list.");
          const scope = recordScope(slug, c);
          for (const key of targets) records.edit(scope, "transcripts", key, { Status: "Issued" });
          return {
            ok: true, entity: `Result transcripts: ${plural(targets.length, "transcript")} issued`,
            message: `Issued ${plural(targets.length, "transcript")}.`,
            download: csvFile(`transcripts-${tidy(period)}.csv`, transcriptCsv(fl, targets, period)),
          };
        },
      },
    ];
  },

  "examinations/final-results": (_ctx, _f, screen) => {
    const t = table(screen, "final-results");
    if (!t) return [];
    const si = idx(t, "Status");
    const pending = t.rows.filter((r, i) => r[si] === "Pending" && !t.rowMeta?.[i]?.archived).length;
    if (pending === 0) return [blocked("Publish results", "publish-results", "Publish results", "Nothing is waiting to be published.")];
    return [
      {
        action: "Publish results",
        spec: {
          id: "publish-results",
          title: "Publish results",
          submitLabel: `Publish ${plural(pending, "result")}`,
          intro: `${plural(pending, "result")} ${pending === 1 ? "is" : "are"} pending. Publishing makes ${pending === 1 ? "it" : "them"} visible to students and guardians.`,
          fields: [],
        },
        async run({ screen: s, slug, ctx: c }) {
          const tbl = table(s, "final-results");
          if (!tbl) return fail("That table is not available.");
          const i = idx(tbl, "Status");
          const keys = tbl.rows.filter((r, n) => r[i] === "Pending" && !tbl.rowMeta?.[n]?.archived).map((r) => r[0]);
          if (keys.length === 0) return fail("Nothing is waiting to be published.");
          const scope = recordScope(slug, c);
          for (const key of keys) records.edit(scope, "final-results", key, { Status: "Published" });
          return { ok: true, entity: `Final results: ${plural(keys.length, "result")} published`, message: `Published ${plural(keys.length, "result")}.` };
        },
      },
    ];
  },

  "registrations/exam-docket": (_ctx, f, screen) => {
    const t = table(screen, "exam-dockets");
    if (!t) return [];
    return [
      {
        action: "Generate dockets",
        spec: {
          id: "generate-dockets",
          title: "Generate dockets",
          submitLabel: "Generate and download",
          intro: "Issues every docket that is not blocked, then downloads the list of issued dockets as a CSV file.",
          fields: [],
        },
        async run({ screen: s, slug, ctx: c, f: fl }) {
          const tbl = table(s, "exam-dockets");
          if (!tbl) return fail("That table is not available.");
          const si = idx(tbl, "Status");
          const scope = recordScope(slug, c);
          const fresh = tbl.rows.filter((r) => r[si] !== "Blocked" && r[si] !== "Issued");
          for (const r of fresh) records.edit(scope, "exam-dockets", r[0], { Status: "Issued" });
          const issued = tbl.rows.filter((r) => r[si] === "Issued" || fresh.includes(r));
          if (issued.length === 0) return fail("No dockets can be issued yet: every docket is blocked.");
          const blockedCount = tbl.rows.filter((r) => r[si] === "Blocked").length;
          return {
            ok: true, entity: `Exam docket: ${plural(fresh.length, "docket")} issued`,
            message: `${plural(fresh.length, "new docket")} issued; ${issued.length} in the downloaded list${blockedCount ? `, ${blockedCount} still blocked` : ""}.`,
            download: csvFile("exam-dockets.csv", docketsCsv(fl, issued.map((r) => [r[0], r[idx(tbl, "Student")], r[idx(tbl, `${fl.terms.courses} on docket`)], r[idx(tbl, "Venue")]]))),
          };
        },
      },
    ];
  },

  "reports/academic-reports": (_c, _f, screen) => reportEntries(screen, "academic-reports", "academic"),
  "reports/finance-reports": (_c, _f, screen) => reportEntries(screen, "finance-reports", "finance"),

  "reports/bank-transactions": (_ctx, _f, screen) => {
    const t = table(screen, "bank-transactions");
    if (!t) return [];
    const columns = ["Date", "Reference", "Bank", "Description", "Amount"];
    return [
      {
        action: "Import statement",
        spec: {
          id: "import-statement",
          title: "Import bank statement",
          submitLabel: "Import",
          intro: "One row per transaction. Lines that mention a known student number are matched; the rest wait as unmatched. A reference already on the list is rejected, and if any row has a problem nothing is imported.",
          fields: [],
          csv: { columns, sample: [["2026-11-05", "TRF-88301", "Zanaco", `Fees: ${LEARNERS[0].no}`, "850.00"]] },
        },
        async run({ csv, screen: s, slug, ctx: c }) {
          const tbl = table(s, "bank-transactions");
          if (!tbl || !csv) return fail("Choose a CSV file.");
          const read = readCsvTable(csv, columns);
          if (!read.ok) return fail(read.message);
          if (read.table.rows.length > MAX_IMPORT_ROWS) return fail(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
          const seen = new Set(tbl.rows.map((r) => normaliseKey(r[idx(tbl, "Reference")])));
          const problems: string[] = [];
          const rows: Record<string, string>[] = [];
          let matched = 0;
          read.table.rows.forEach((r, i) => {
            const n = i + 2;
            const iso = parseLooseDate(r["Date"]);
            const amount = r["Amount"].replace(/^K\s*/i, "").replace(/[,\s]/g, "");
            const ref = r["Reference"];
            if (!iso) problems.push(`Row ${n}: "${r["Date"]}" is not a valid date.`);
            if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) problems.push(`Row ${n}: amount must be a positive number.`);
            if (!ref || ref.length > 40) problems.push(`Row ${n}: reference is required (40 characters at most).`);
            else if (seen.has(normaliseKey(ref))) problems.push(`Row ${n}: reference ${ref} is already on the list.`);
            if (!r["Bank"] || r["Bank"].length > 30) problems.push(`Row ${n}: bank is required (30 characters at most).`);
            if (!iso || !/^\d+(\.\d{1,2})?$/.test(amount) || !ref || seen.has(normaliseKey(ref)) || !r["Bank"] || r["Bank"].length > 30 || ref.length > 40) return;
            seen.add(normaliseKey(ref));
            const hit = [...r["Description"].matchAll(/\b[A-Z]{2,4}-(\d{3,5})\b/g)].some((m) => KNOWN_DIGITS.has(m[1]));
            if (hit) matched += 1;
            rows.push({ Date: formatDate(iso), Reference: ref, Bank: r["Bank"], Description: r["Description"] || "—", Amount: K(Number(amount)), Status: hit ? "Matched" : "Unmatched" });
          });
          if (problems.length > 0) return problemsOutcome("the statement", problems);
          const scope = recordScope(slug, c);
          for (const row of [...rows].reverse()) records.add(scope, "bank-transactions", row);
          return { ok: true, entity: `Bank transactions: ${plural(rows.length, "line")} imported`, message: `Imported ${plural(rows.length, "line")}: ${matched} matched, ${rows.length - matched} unmatched.` };
        },
      },
    ];
  },

  subscriptions: (ctx) => [
    {
      action: "Change plan",
      spec: {
        id: "change-plan",
        title: "Change plan",
        submitLabel: "Change plan",
        intro: "Moves a school to another plan. Billing follows the new plan from its next renewal.",
        fields: [
          { name: "school", label: "School", type: "select", required: true, options: ctx.tenants.map((t) => t.name) },
          { name: "plan", label: "New plan", type: "select", required: true, options: ["Starter", "Growth", "Enterprise"] },
        ],
      },
      async run({ values, ctx: c }) {
        const tenant = c.tenants.find((t) => t.name === str(values, "school"));
        const plan = str(values, "plan") as "Starter" | "Growth" | "Enterprise";
        if (!tenant) return fail("That school no longer exists.", { errors: { school: "Choose a school." } });
        if (tenant.plan === plan) return fail(`${tenant.name} is already on ${plan}.`, { errors: { plan: "Choose a different plan." } });
        await tenantDirectory.update(tenant.id, { plan });
        return { ok: true, entity: `Subscriptions: ${tenant.name} ${tenant.plan} to ${plan}`, message: `${tenant.name} is now on ${plan}.` };
      },
    },
  ],

  "platform-settings": (_ctx, _f, screen) => {
    const t = table(screen, "settings");
    if (!t) return [];
    const fields: FieldDef[] = t.rows.map((r, i) => ({ name: `s${i}`, label: r[0], type: "text", required: true, maxLength: 60, defaultValue: r[1] }));
    return [
      {
        action: "Edit settings",
        spec: { id: "edit-settings", title: "Edit settings", submitLabel: "Save settings", intro: "Change several general settings at once.", fields },
        async run({ values, screen: s, slug, ctx: c }) {
          const tbl = table(s, "settings");
          if (!tbl) return fail("That table is not available.");
          const errors: FormErrors = {};
          const changes: Array<[string, string]> = [];
          tbl.rows.forEach((r, i) => {
            const v = str(values, `s${i}`).trim();
            if (v === "") { errors[`s${i}`] = `${r[0]} is required.`; return; }
            if (r[0] === "Academic year start" && !MONTH_NAMES_FULL.includes(v)) { errors[`s${i}`] = "Use a month name such as January."; return; }
            if (r[0] === "Session timeout") {
              const m = /^(\d{1,3}) minutes?$/.exec(v);
              if (!m || Number(m[1]) < 5 || Number(m[1]) > 480) { errors[`s${i}`] = 'Use 5 to 480 minutes, like "30 minutes".'; return; }
            }
            if (v !== r[1]) changes.push([r[0], v]);
          });
          if (Object.keys(errors).length > 0) return fail("Fix the highlighted settings.", { errors });
          if (changes.length === 0) return fail("No settings were changed.");
          const scope = recordScope(slug, c);
          for (const [key, v] of changes) records.edit(scope, "settings", key, { Value: v });
          return { ok: true, entity: `General settings: ${changes.map(([k]) => k).join(", ")}`, message: `Saved ${plural(changes.length, "setting")}.` };
        },
      },
    ];
  },

  "data-export-and-backup": (_ctx, _f, screen) => {
    const backups = table(screen, "backups");
    const exports = table(screen, "exports");
    const entries: ProcessEntry[] = [];
    if (backups) {
      entries.push({
        action: "Run backup now",
        spec: { id: "run-backup", title: "Run backup now", submitLabel: "Run backup", intro: `Takes a manual backup. ${DEPLOYMENTS[DEPLOYMENT_MODE].backups}.`, fields: [] },
        async run({ screen: s, slug, ctx: c, timeZone: zone }) {
          const tbl = table(s, "backups");
          if (!tbl) return fail("That table is not available.");
          const id = nextKey(tbl.rows.map((r) => r[0]), "BK-", 4);
          records.add(recordScope(slug, c), "backups", {
            Backup: id, Date: formatStamp(new Date().toISOString(), zone), Type: "Manual", Size: "1.8 GB",
            "Kept by": DEPLOYMENTS[DEPLOYMENT_MODE].operator, Status: "Completed",
          });
          return { ok: true, entity: `Backups: ${id}`, message: `Backup ${id} completed.` };
        },
      });
    }
    if (exports) {
      entries.push({
        action: "Export data",
        spec: {
          id: "export-data",
          title: "Export data",
          submitLabel: "Export and download",
          intro: "Downloads the dataset as a CSV file. The school owns its data and can export it at any time.",
          fields: [{ name: "dataset", label: "Dataset", type: "select", required: true, options: exports.rows.map((r) => r[0]) }],
        },
        async run({ values, screen: s, slug, ctx: c, f: fl, timeZone: zone }) {
          const tbl = table(s, "exports");
          const dataset = str(values, "dataset");
          if (!tbl?.rows.some((r) => r[0] === dataset)) return fail("Choose a dataset.", { errors: { dataset: "Choose a dataset." } });
          records.edit(recordScope(slug, c), "exports", dataset, { "Last export": todayIn(zone).display, Status: "Ready" });
          return {
            ok: true, entity: `Data exports: ${dataset}`, message: `Exported ${dataset}.`,
            download: csvFile(`${tidy(fl.tenantName)}-${tidy(dataset)}.csv`, exportCsv(dataset, fl)),
          };
        },
      });
    }
    return entries;
  },
};

const MONTH_NAMES_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function reportEntries(screen: PlatformScreen, tableId: string, kind: "academic" | "finance"): ProcessEntry[] {
  const t = table(screen, tableId);
  if (!t) return [];
  return [
    {
      action: "Generate report",
      spec: {
        id: `generate-${kind}-report`,
        title: "Generate report",
        submitLabel: "Generate and download",
        intro: "Builds the report, marks it ready and downloads it as a CSV file.",
        fields: [{ name: "report", label: "Report", type: "select", required: true, options: t.rows.map((r) => r[0]) }],
      },
      async run({ values, screen: s, slug, ctx: c, f, timeZone: zone }) {
        const tbl = table(s, tableId);
        const name = str(values, "report");
        if (!tbl?.rows.some((r) => r[0] === name)) return fail("Choose a report.", { errors: { report: "Choose a report." } });
        records.edit(recordScope(slug, c), tableId, name, { Status: "Ready", Generated: todayIn(zone).display });
        return { ok: true, entity: `${tbl.title}: ${name}`, message: `${name} is ready.`, download: csvFile(`${tidy(name)}.csv`, reportCsv(kind, name, f)) };
      },
    },
  ];
}

/** Page slugs that have process buttons. */
export const PROCESS_SLUGS = Object.keys(MAKERS);

const needsDivision = (slug: string, ctx: PlatformContext) =>
  isDivisionScoped(slug) && (ctx.tenant?.divisions.length ?? 0) > 1 && !ctx.division;

/** Entries for a page, built from the screen's current tables. */
export function processesFor(slug: string, ctx: PlatformContext, screen: PlatformScreen): ProcessEntry[] {
  const maker = MAKERS[slug];
  return maker ? maker(ctx, flavour(ctx), screen) : [];
}

/**
 * Entries as the screen offers them. In an all-divisions view the choices
 * depend on one division's data, so each button carries one spec per division
 * and its dialog asks which division to use. `screenFor` builds that
 * division's own screen.
 */
export function offeredProcesses(
  slug: string,
  ctx: PlatformContext,
  screen: PlatformScreen,
  screenFor?: (division: Division) => PlatformScreen,
): ProcessEntry[] {
  if (!needsDivision(slug, ctx) || !screenFor) return processesFor(slug, ctx, screen);
  const byAction = new Map<string, Array<{ division: Division; entry: ProcessEntry }>>();
  for (const division of ctx.tenant?.divisions ?? []) {
    for (const entry of processesFor(slug, { ...ctx, division }, screenFor(division))) {
      byAction.set(entry.action, [...(byAction.get(entry.action) ?? []), { division, entry }]);
    }
  }
  return [...byAction].map(([action, list]) => {
    const first = list[0].entry;
    return {
      action,
      spec: {
        ...first.spec,
        fields: [],
        csv: undefined,
        divisions: list.map(({ division, entry }) => ({ id: division.id, name: division.name, spec: entry.spec })),
      },
      run: first.run,
    };
  });
}
