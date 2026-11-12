/** One change made through the Platform Admin forms. */
export type AuditEntry = {
  /** ISO time the change was made. */
  at: string;
  user: string;
  /** e.g. "Record created", "Record archived". */
  action: string;
  /** What changed, e.g. "Campuses: East Campus". */
  entity: string;
  /** School id the change belongs to, or "platform". */
  scope: string;
  /** School name for display, or "Platform". */
  school: string;
};

/**
 * Where form changes are logged. A real implementation appends to a
 * tamper-resistant store and must record the real signed-in user.
 */
export interface AuditLog {
  record(entry: Omit<AuditEntry, "at">): void;
  /** Newest first. */
  list(): AuditEntry[];
}
