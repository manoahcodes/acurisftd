"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { FileDown, Printer, X } from "lucide-react";
import { cn, todayIn } from "@/lib/format";
import { toCsv } from "@/lib/csv";

export const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-brand disabled:bg-canvas disabled:text-muted";
export const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-[15px] font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50";
export const primaryClass =
  "inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[15px] font-semibold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60";

const subscribe = () => () => {};

/**
 * Today's date ("YYYY-MM-DD") in the school's zone. Empty on the server and on
 * the first client render: the server must not read the clock while
 * prerendering, so the date appears once the page is in the browser.
 */
export function useToday(timezone: string): string {
  return useSyncExternalStore(subscribe, () => todayIn(timezone).iso, () => "");
}

const TONES = {
  good: "bg-positive-soft text-positive",
  warn: "bg-warning-soft text-warning",
  bad: "bg-danger-soft text-danger",
  info: "bg-canvas text-muted",
} as const;

export function Chip({ tone = "info", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium", TONES[tone])}>{children}</span>;
}

/** A modal on the native <dialog>: focus is trapped, Escape closes, and the page behind is inert. */
export function Dialog({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn("m-auto max-h-[90dvh] rounded-2xl border border-line bg-surface p-0 shadow-xl backdrop:bg-black/50", wide ? "w-[min(60rem,calc(100vw-2rem))]" : "w-[min(34rem,calc(100vw-2rem))]")}
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={`${id}-t`} className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}

export function Field({ label, error, help, required, children }: { label: string; error?: string; help?: string; required?: boolean; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode }) {
  const id = useId();
  const describedBy = error ? `${id}-e` : help ? `${id}-h` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden className="text-danger"> *</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-e`} className="mt-1 text-sm text-danger">{error}</p>
      ) : help ? (
        <p id={`${id}-h`} className="mt-1 text-sm text-muted">{help}</p>
      ) : null}
    </div>
  );
}

/** Saves text as a file in the browser. */
export function downloadCsv(filename: string, rows: string[][]) {
  const url = URL.createObjectURL(new Blob(["﻿", toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportBar({ onCsv, onPrint, disabled }: { onCsv: () => void; onPrint: () => void; disabled?: boolean }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onCsv} disabled={disabled} className={buttonClass}>
        <FileDown size={16} aria-hidden /> Export CSV
      </button>
      <button type="button" onClick={onPrint} disabled={disabled} className={buttonClass}>
        <Printer size={16} aria-hidden /> Print
      </button>
    </div>
  );
}

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn("rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>{children}</section>
);

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-canvas px-4 py-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold text-ink">{value}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
    </div>
  );
}

export const rateTone = (rate: number | null): keyof typeof TONES => (rate === null ? "info" : rate >= 90 ? "good" : rate >= 75 ? "warn" : "bad");
export const rateText = (rate: number | null) => (rate === null ? "—" : `${rate}%`);
