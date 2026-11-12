import type { AuditEntry, AuditLog } from "./audit-types";

// Kept on globalThis so a dev-server reload does not wipe the log.
const g = globalThis as unknown as { __acurisAudit?: AuditEntry[] };
const log = (g.__acurisAudit ??= []);

export const mockAuditLog: AuditLog = {
  record(entry) {
    log.unshift({ ...entry, at: new Date().toISOString() });
  },
  list: () => [...log],
};

/** Test helper: forget everything. */
export const resetMockAudit = () => {
  log.length = 0;
};
