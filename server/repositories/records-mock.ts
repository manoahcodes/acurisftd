import { emptyOverlay, type TableOverlay } from "@/lib/forms/overlay";
import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { RecordStore } from "./records-types";

// Kept on globalThis so a dev-server reload does not wipe what was entered.
const g = globalThis as unknown as { __acurisRecords?: Map<string, TableOverlay> };
const KEY = "records";
const data = (g.__acurisRecords ??= new Map<string, TableOverlay>(loadSnapshot<Array<[string, TableOverlay]>>(KEY) ?? []));
const save = () => saveSnapshot(KEY, [...data]);

const without = (m: Record<string, true> | undefined, key: string): Record<string, true> =>
  Object.fromEntries(Object.entries(m ?? {}).filter(([k]) => k !== key)) as Record<string, true>;

const k = (scope: string, tableId: string) => `${scope}::${tableId}`;

function get(scope: string, tableId: string): TableOverlay {
  let o = data.get(k(scope, tableId));
  if (!o) {
    o = emptyOverlay();
    data.set(k(scope, tableId), o);
  }
  return o;
}

export const mockRecordStore: RecordStore = {
  overlay: (scope, tableId) => data.get(k(scope, tableId)),
  add(scope, tableId, row) {
    get(scope, tableId).added.unshift(row);
    save();
  },
  edit(scope, tableId, key, values) {
    const o = get(scope, tableId);
    o.edits[key] = { ...o.edits[key], ...values };
    save();
  },
  archive(scope, tableId, key) {
    const o = get(scope, tableId);
    o.archived = { ...o.archived, [key]: true };
    save();
  },
  restore(scope, tableId, key) {
    const o = get(scope, tableId);
    o.archived = without(o.archived, key);
    save();
  },
  removeAdded(scope, tableId, index, key) {
    const o = get(scope, tableId);
    o.added.splice(index, 1);
    delete o.edits[key];
    o.archived = without(o.archived, key);
    save();
  },
};

/** Test helper: forget everything. */
export const resetMockRecords = () => {
  data.clear();
  save();
};
