import { loadSnapshot, saveSnapshot } from "../persistence/store";
import type { AuditEntry, AuditLog } from "./audit-types";

// Kept on globalThis so a dev-server reload does not wipe the log.
const g = globalThis as unknown as { __acurisAudit?: AuditEntry[] };
const KEY = "audit";
const log = (g.__acurisAudit ??= loadSnapshot<AuditEntry[]>(KEY) ?? []);

export const mockAuditLog: AuditLog = {
  record(entry) {
    log.unshift({ ...entry, at: new Date().toISOString() });
    saveSnapshot(KEY, log);
  },
  list: () => [...log],
};

/** Test helper: forget everything. */
export const resetMockAudit = () => {
  log.length = 0;
  saveSnapshot(KEY, log);
};
