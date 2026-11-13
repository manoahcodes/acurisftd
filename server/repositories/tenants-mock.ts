import type { TenantSummary } from "@/types/platform";
import { assertSharedSystem, INSTITUTIONS, type Division, type InstitutionType } from "@/config/institution";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { TenantDirectory } from "./platform-types";

const CODES: Record<InstitutionType, string> = { primary: "PRI", high_school: "HS", college: "COL", university: "UNI" };

/** A tenant with a single division, named after its institution type. */
const single = (type: InstitutionType): Division[] => [
  { id: type, name: INSTITUTIONS[type].label, code: CODES[type], institutionType: type },
];

/** A combined school: one division per type, all on the same academic system. */
const combined = (...types: InstitutionType[]): Division[] => types.flatMap(single);

export const TENANTS: TenantSummary[] = [
  { id: "lusaka-hills", name: "Lusaka Hills Academy", divisions: combined("primary", "high_school"), campuses: 2, learners: 1248, plan: "Growth", status: "Active" },
  { id: "chilenje", name: "Chilenje Secondary", divisions: single("high_school"), campuses: 1, learners: 2104, plan: "Growth", status: "Active" },
  { id: "northview", name: "Northview Primary", divisions: single("primary"), campuses: 1, learners: 684, plan: "Starter", status: "Trial" },
  { id: "mukuba", name: "Mukuba Learning Centre", divisions: single("college"), campuses: 2, learners: 950, plan: "Growth", status: "Active" },
  { id: "kafue-valley", name: "Kafue Valley College", divisions: single("college"), campuses: 3, learners: 1720, plan: "Enterprise", status: "Active" },
  { id: "zambezi-university", name: "Zambezi University", divisions: single("university"), campuses: 3, learners: 6400, plan: "Enterprise", status: "Active" },
];

// Data sanity: every tenant keeps one academic system across its divisions.
TENANTS.forEach((t) => assertSharedSystem(t.name, t.divisions));

// Schools added, changed or removed since the first run come back after a restart.
const KEY = "tenants";
const savedTenants = loadSnapshot<TenantSummary[]>(KEY);
if (savedTenants) TENANTS.splice(0, TENANTS.length, ...savedTenants);
const save = () => saveSnapshot(KEY, TENANTS);

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "school";

export const mockTenantDirectory: TenantDirectory = {
  async list() {
    return [...TENANTS];
  },
  async create({ name, plan, status, campuses, types }) {
    const divisions = combined(...types);
    // Same rule as the seed data: one academic system per school.
    assertSharedSystem(name, divisions);
    let id = slugify(name);
    for (let n = 2; TENANTS.some((t) => t.id === id); n++) id = `${slugify(name)}-${n}`;
    const tenant: TenantSummary = { id, name, divisions, campuses, learners: 0, plan, status };
    TENANTS.push(tenant);
    save();
    return tenant;
  },
  async remove(id) {
    const i = TENANTS.findIndex((t) => t.id === id);
    // A school with learners has history: suspend it instead.
    if (i < 0 || TENANTS[i].learners > 0) return false;
    TENANTS.splice(i, 1);
    save();
    return true;
  },
  async update(id, changes) {
    const i = TENANTS.findIndex((t) => t.id === id);
    if (i < 0) return undefined;
    const { types, ...rest } = changes;
    let divisions = TENANTS[i].divisions;
    if (types) {
      // Keep the divisions the school has (same id and code), then add new ones.
      const kept = divisions.filter((d) => types.includes(d.institutionType));
      const added = types.filter((t) => !divisions.some((d) => d.institutionType === t)).flatMap(single);
      divisions = [...kept, ...added];
      assertSharedSystem(TENANTS[i].name, divisions);
    }
    // Replace rather than mutate, so cached lists never show half an update.
    TENANTS[i] = { ...TENANTS[i], ...rest, divisions };
    save();
    return TENANTS[i];
  },
};
