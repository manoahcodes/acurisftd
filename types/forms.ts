/**
 * Create / edit forms for the Platform Admin list screens.
 *
 * A FormSpec is plain data (no functions) so the server can build it for the
 * current school and send it to the browser. The server action rebuilds the
 * same spec and validates against that copy, never against what the browser
 * says the form looked like.
 */

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "money"
  | "date"
  | "select"
  | "multiselect"
  | "textarea";

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  /** Header of the table column this field fills. Fields without one are not shown in the table. */
  column?: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  /** Shown but not changeable when editing (identifiers, mainly). */
  lockedOnEdit?: boolean;
  /** Pre-filled value when creating. */
  defaultValue?: string;
  /** Text added after the value in the table, e.g. "%". */
  suffix?: string;
  /** Not shown when editing (for choices that cannot change afterwards). */
  createOnly?: boolean;
  /**
   * The system fills this in on create (receipt numbers, student numbers). It
   * is shown read-only, never asked for, and cannot be edited.
   */
  auto?: { prefix: string; digits: number };
};

/** What a successful submit does. "tenant" changes a school; "row" adds or edits a table row. */
export type FormTarget = "row" | "tenant";

export type FormSpec = {
  /** Stable id, e.g. "campus". Used by the server to find the spec again. */
  id: string;
  title: string;
  submitLabel: string;
  target: FormTarget;
  /** Table (by TableSection.id) the form adds rows to and edits rows of. */
  tableId: string;
  fields: FieldDef[];
  /**
   * Columns that together identify a row (default: the table's first column).
   * A new row may not repeat an existing key, and an edit finds its row by it.
   */
  keyColumns: string[];
  /** Values a new row gets for columns the form does not ask about. */
  rowDefaults?: Record<string, string>;
  /** Division the record belongs to. Required when the school has several and none is picked. */
  divisionChoices?: Array<{ id: string; name: string }>;
  /**
   * With divisionChoices: the fields (and defaults) for each division, because
   * options such as classes differ between a Primary and a High School division.
   */
  variants?: Record<string, { fields: FieldDef[]; rowDefaults?: Record<string, string> }>;
  /** Edit-only forms have no "create" button on the screen (e.g. settings values). */
  editOnly?: boolean;
  /** No edit button on rows (receipts, audit-style records). */
  createOnly?: boolean;
  /** Records here carry history (payments, results): they can be archived but never deleted. */
  keep?: boolean;
};

/** The forms a screen offers, keyed so the UI can match them to buttons and tables. */
export type ScreenForms = {
  /** Action button label → form it opens. */
  actions: Record<string, FormSpec>;
  /** TableSection.id → form used to edit that table's rows. */
  edits: Record<string, FormSpec>;
  /** TableSection.id → the form that owns its rows, for archive and delete (also for tables without an edit form). */
  rows: Record<string, FormSpec>;
};

export type FormValues = Record<string, string | string[]>;

export type FormErrors = Record<string, string>;

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: FormErrors;
  /** Values to put back in the form after an error. */
  values?: FormValues;
};
