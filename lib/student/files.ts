/**
 * What a student may attach to a submission, checked by the file's own bytes,
 * never by its name or the browser's MIME claim. Text files (SVG and HTML
 * included) are stored and served only as a text/plain attachment, so
 * nothing a student uploads can run as a page.
 */
export const MAX_SUBMISSION_BYTES = 2 * 1024 * 1024;

export const SUBMISSION_TYPES = {
  "application/pdf": "PDF",
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "text/plain": "text file",
} as const;
export type SubmissionType = keyof typeof SUBMISSION_TYPES;

export const ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,.docx,.txt";

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);

/** True when `bytes` is a Word .docx: a zip file that holds word/document.xml. */
function isDocx(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return false;
  // File names are stored unencrypted in the zip's local headers.
  return Buffer.from(bytes).includes("word/document.xml");
}

/** Plain text: valid UTF-8 with no control characters other than tab and line breaks. SVG and HTML pass as text, but they are only ever stored and served as a text/plain attachment, so they cannot run. */
function isText(bytes: Uint8Array): boolean {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
  } catch {
    return false;
  }
}

export function sniffSubmission(bytes: Uint8Array): SubmissionType | undefined {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (isDocx(bytes)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (bytes.length > 0 && isText(bytes)) return "text/plain";
  return undefined;
}

/** A name that is safe to store and to put in a download header. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  const out = cleaned.slice(-80);
  return out || "submission";
}

export const formatBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 102.4) / 10} KB` : `${Math.round(n / 104857.6) / 10} MB`);

export type ReadFile = { ok: true; file: { name: string; size: number; type: SubmissionType; data: string } } | { ok: false; error: string };

/** Reads an uploaded file and checks it. Returns the bytes as base64 for storage. */
export async function readSubmissionFile(file: File): Promise<ReadFile> {
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_SUBMISSION_BYTES) return { ok: false, error: `The file must be ${formatBytes(MAX_SUBMISSION_BYTES)} or smaller.` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffSubmission(bytes);
  if (!type) return { ok: false, error: "Attach a PDF, Word document, PNG or JPEG image, or a plain text file." };
  return { ok: true, file: { name: safeFileName(file.name), size: bytes.length, type, data: Buffer.from(bytes).toString("base64") } };
}
