import { emptyOverlay, type TableOverlay } from "@/lib/forms/overlay";
import type { RecordStore } from "./records-types";

// Kept on globalThis so a dev-server reload does not wipe what was entered.
const g = globalThis as unknown as { __acurisRecords?: Map<string, TableOverlay> };
const data = (g.__acurisRecords ??= new Map<string, TableOverlay>());

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
  },
  edit(scope, tableId, key, values) {
    const o = get(scope, tableId);
    o.edits[key] = { ...o.edits[key], ...values };
  },
};

/** Test helper: forget everything. */
export const resetMockRecords = () => data.clear();
