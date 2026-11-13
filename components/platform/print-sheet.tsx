"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { formatStamp } from "@/lib/format";
import type { PrintBranding } from "@/lib/print";

/**
 * A print-ready page over the app: the school's logo and document header, the
 * content, then the document footer and signature line. "Print / Save as PDF"
 * opens the browser's print dialog, where "Save as PDF" is a destination. While
 * it is open only this sheet prints (see the @media print rules in globals.css).
 */
export function PrintSheet({
  branding,
  title,
  lines,
  signature = false,
  onClose,
  children,
}: {
  branding: PrintBranding;
  title: string;
  /** Small lines under the title, e.g. the filters that were applied. */
  lines?: string[];
  /** Adds a signature line (transcripts, dockets and receipts). */
  signature?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  // Read when the sheet opens (a click), never while prerendering.
  const [printedAt] = useState(() => formatStamp(new Date().toISOString(), branding.timezone));

  useEffect(() => {
    document.body.classList.add("printing-sheet");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("printing-sheet");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="print-portal fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`${title}, print preview`}>
      <div className="print-hide mx-auto mb-3 flex max-w-4xl justify-end gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Printer size={16} aria-hidden /> Print / Save as PDF
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X size={16} aria-hidden /> Close
        </button>
      </div>

      <article className="print-paper mx-auto max-w-4xl rounded-xl bg-white p-8 text-[#111] shadow-xl sm:p-12">
        <header className="flex items-start gap-4 border-b-2 border-[#111] pb-4">
          {branding.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- the logo is a stored data URL
            <img src={branding.logoUrl} alt="" className="h-16 w-16 object-contain" />
          )}
          <div>
            <p className="text-xl font-bold">{branding.name}</p>
            {branding.documentHeader && <p className="mt-1 whitespace-pre-line text-sm text-[#444]">{branding.documentHeader}</p>}
          </div>
        </header>

        <h1 className="mt-6 text-2xl font-bold">{title}</h1>
        {lines?.map((l) => (
          <p key={l} className="mt-1 text-sm text-[#444]">{l}</p>
        ))}

        <div className="mt-6">{children}</div>

        {signature && (
          <div className="mt-16 w-64">
            <div className="border-t border-[#111] pt-1 text-sm">{branding.signatureLine || "Registrar"}</div>
          </div>
        )}

        <footer className="mt-10 border-t border-[#bbb] pt-3 text-xs text-[#555]">
          {branding.documentFooter && <p className="whitespace-pre-line">{branding.documentFooter}</p>}
          <p>Printed {printedAt}</p>
        </footer>
      </article>
    </div>,
    document.body,
  );
}

/** A single record as a two-column list (transcript, docket, receipt). */
export function DetailsList({ details }: { details: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[12rem_1fr] gap-x-6 gap-y-2 text-[15px]">
      {details.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-[#444]">{k}</dt>
          <dd>{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Rows as a plain bordered table for printing. */
export function PrintTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} className="border-b-2 border-[#111] px-2 py-1.5 font-semibold">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="border-b border-[#ccc] px-2 py-1.5">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
