import type { FieldDef, FormErrors, FormValues } from "./forms";

/**
 * A button that does a job instead of filling one row: import a CSV, generate
 * a file, publish results. Like a FormSpec it is plain data, so the server can
 * send it to the browser and rebuild the same one when the action runs.
 */
export type ProcessSpec = {
  /** Stable id, e.g. "import-students". */
  id: string;
  title: string;
  submitLabel: string;
  /** What will happen, in a sentence or two. */
  intro?: string;
  /** Asked before running (a choice, a setting). */
  fields: FieldDef[];
  /** Shows a file picker for a CSV with these columns, and a template to download. */
  csv?: { columns: string[]; sample: string[][] };
  /** Cannot run now; `intro` says why (e.g. pick a division first). */
  blocked?: boolean;
  /**
   * In a school with several divisions viewed as a whole, each division has its
   * own questions and CSV columns. The dialog asks for the division first and
   * then shows that division's spec.
   */
  divisions?: Array<{ id: string; name: string; spec: ProcessSpec }>;
};

/** A file the browser should save. */
export type Download = { filename: string; mime: string; content: string };

export type ProcessState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Row-by-row problems from an import (first few). */
  problems?: string[];
  errors?: FormErrors;
  values?: FormValues;
  download?: Download;
};
