import type { TableOverlay } from "@/lib/forms/overlay";

/**
 * Where records created or edited through forms are kept. The UI only knows
 * this interface; the mock keeps them in memory. A real implementation writes
 * to the database, and must check the session's role and tenant on every call.
 *
 * `scope` says whose records they are: "platform" for platform-wide pages,
 * otherwise a school (and division) such as "lusaka-hills:primary".
 */
export interface RecordStore {
  overlay(scope: string, tableId: string): TableOverlay | undefined;
  add(scope: string, tableId: string, row: Record<string, string>): void;
  /** `key` is the row's original first-column value. Merges into earlier edits. */
  edit(scope: string, tableId: string, key: string, values: Record<string, string>): void;
}
